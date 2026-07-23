#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
닥터그린 2단계 파이프라인 — ② 크롭 기반 파인그레인드 분류: 내보내기(export)
================================================================================

best.pt -> TorchScript(.pt) + ONNX(.onnx, dynamic batch) 로 내보낸다.
출력 텐서 shape 를 출력하고, class 순서/전처리(mean/std/img_size)를 classes.json 옆에 남긴다.

배포 경로
  - HF Space(Gradio) 2단계 서빙: 1단계 YOLO 가 박스를 주면, 각 박스 크롭을 이 분류기(TorchScript
    또는 ONNXRuntime)로 재분류해 병명 정확도를 높인다. 응답 스키마(detections/box/confidence/
    severity 등)는 그대로 유지 — 분류기는 각 detection 의 name/name_en/confidence 만 교체.

  - edu 앱(브라우저 tfjs) 통합용 tfjs 변환은 여기서 구현하지 않고 경로만 문서화한다:
      경로 A (권장): ONNX -> onnx-tf (SavedModel) -> tensorflowjs_converter (tfjs graph model)
          pip install onnx onnx-tf tensorflowjs
          onnx-tf convert -i best.onnx -o tf_saved_model
          tensorflowjs_converter --input_format=tf_saved_model tf_saved_model web_model
      경로 B (대안): timm 모델을 keras/tf 로 재구현 후 가중치 이식 -> tfjs. (수작업 많음, 비권장)
      주의: convnext/efficientnetv2 의 일부 연산은 onnx-tf 커버리지 이슈가 있을 수 있어,
            tfjs 대상일 때는 export 시 --opset 13~17 범위를 바꿔가며 변환 성공 조합을 찾는다.
            브라우저 경량화가 목적이면 tf_efficientnetv2_s 쪽이 변환/성능 균형이 낫다.

사용법:
    python export_classifier.py --ckpt runs/cls/best.pt --out runs/cls/export --opset 17
"""

import argparse
import json
import sys
from pathlib import Path

import torch
import timm


def log(msg=""):
    print(msg, flush=True)


def main(argv=None):
    p = argparse.ArgumentParser(description="크롭 분류기 export (TorchScript + ONNX)")
    p.add_argument("--ckpt", required=True, help="best.pt 경로")
    p.add_argument("--out", required=True, help="export 결과 폴더")
    p.add_argument("--opset", type=int, default=17, help="ONNX opset (기본 17)")
    p.add_argument("--img-size", type=int, default=0, help="0이면 ckpt의 img_size 사용")
    args = p.parse_args(argv if argv is not None else sys.argv[1:])

    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)

    ckpt = torch.load(args.ckpt, map_location="cpu", weights_only=False)
    classes = ckpt["classes"]
    num_classes = len(classes)
    img_size = args.img_size or ckpt.get("img_size", 384)
    mean = ckpt.get("mean", (0.485, 0.456, 0.406))
    std = ckpt.get("std", (0.229, 0.224, 0.225))

    model = timm.create_model(ckpt["model"], pretrained=False, num_classes=num_classes)
    model.load_state_dict(ckpt["state_dict"])
    model.eval()

    example = torch.randn(1, 3, img_size, img_size)
    with torch.no_grad():
        out_shape = tuple(model(example).shape)
    log(f"[모델] {ckpt['model']} | classes={classes} | img_size={img_size}")
    log(f"[출력 shape] (1,3,{img_size},{img_size}) -> {out_shape}")

    # 1) TorchScript (trace)
    ts_path = out / "classifier_ts.pt"
    with torch.no_grad():
        traced = torch.jit.trace(model, example)
    traced.save(str(ts_path))
    with torch.no_grad():
        ts_out = tuple(traced(example).shape)
    log(f"[TorchScript] 저장: {ts_path}  출력 shape {ts_out}")

    # 2) ONNX (dynamic batch)
    #    최신 torch(2.x 후반)는 dynamo 기반 exporter가 기본이라 onnxscript 설치를 요구한다.
    #    호환성을 위해 레거시(TorchScript 기반) exporter를 우선 사용한다(dynamo=False).
    #    dynamo 인자를 모르는 옛 torch면 인자 없이 재시도한다.
    onnx_path = out / "classifier.onnx"
    common = dict(
        input_names=["input"], output_names=["logits"],
        dynamic_axes={"input": {0: "batch"}, "logits": {0: "batch"}},
        opset_version=args.opset,
    )
    try:
        torch.onnx.export(model, example, str(onnx_path), dynamo=False, **common)
    except TypeError:
        # 구버전 torch: dynamo 인자 없음
        torch.onnx.export(model, example, str(onnx_path), **common)
    log(f"[ONNX] 저장: {onnx_path}  (opset={args.opset}, dynamic batch)")

    # ONNX 검증(설치돼 있으면)
    try:
        import onnx
        m = onnx.load(str(onnx_path))
        onnx.checker.check_model(m)
        out_shapes = []
        for o in m.graph.output:
            dims = [d.dim_param or d.dim_value for d in o.type.tensor_type.shape.dim]
            out_shapes.append((o.name, dims))
        log(f"[ONNX] check 통과. 출력: {out_shapes}")
    except ImportError:
        log("[ONNX] onnx 미설치 — check 건너뜀")

    # 메타데이터 — 서빙 전처리/라벨 매핑용
    meta = {
        "model": ckpt["model"],
        "classes": list(classes),
        "img_size": img_size,
        "mean": list(mean),
        "std": list(std),
        "opset": args.opset,
        "output_shape": list(out_shape),
        "note": "detections 재분류용. box/severity 는 1단계 YOLO 값을 유지, name/confidence 만 교체.",
    }
    (out / "export_meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    log(f"[메타] {out / 'export_meta.json'}")
    log("")
    log("tfjs 변환(edu 앱용)은 이 스크립트에서 구현하지 않음 — 상단 docstring 경로 A/B 참조.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
