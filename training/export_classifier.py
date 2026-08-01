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

# 클래스명(한글) -> 영문 슬러그. HF Space 서빙이 Detection.name_en 을 채우는 데 쓴다.
# (eval_classifier.py 의 KOR_TO_EN_SLUG 와 동일한 값으로 맞춰 둘 것 — 클래스가 늘면 둘 다 갱신)
KOR_TO_EN = {
    "정상": "healthy",
    "역병": "blight",
    "시들음병": "wilt",
    "잎끝마름": "leaf_scorch",
    "황화": "chlorosis",
}


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
        eager_out = model(example)
        ts_out_t = traced(example)
    ts_out = tuple(ts_out_t.shape)
    log(f"[TorchScript] 저장: {ts_path}  출력 shape {ts_out}")
    # shape뿐 아니라 실제 수치도 원본 모델과 일치하는지 확인(timm 버전에 따라 트레이스 중
    # adaptive pooling/SE 모듈 등의 조건부 분기가 갈릴 수 있음).
    if torch.allclose(eager_out, ts_out_t, atol=1e-4):
        log("[검증] TorchScript 출력이 원본 모델과 수치 일치(atol=1e-4).")
    else:
        max_diff = (eager_out - ts_out_t).abs().max().item()
        log(f"[경고] TorchScript 출력이 원본 모델과 1e-4 이내로 일치하지 않습니다(최대 차이 {max_diff:.6f}). "
            "timm 버전에 따라 트레이스 중 그래프가 갈렸을 수 있으니 배포 전 재확인하세요.")

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
        # 구버전 torch: dynamo 인자 자체를 모름 -> 인자 없이 재시도(그 시절엔 레거시 exporter가 기본)
        try:
            torch.onnx.export(model, example, str(onnx_path), **common)
        except Exception as e:
            # 최신 torch가 레거시(TorchScript 기반) exporter를 완전히 제거한 경우를 대비해
            # dynamo 전용 exporter로 마지막 재시도. (onnxscript 설치가 필요할 수 있음)
            log(f"[경고] 레거시 ONNX exporter 실패({e}) — dynamo 전용 exporter로 재시도합니다.")
            torch.onnx.export(
                model, example, str(onnx_path), dynamo=True,
                input_names=["input"], output_names=["logits"],
                dynamic_shapes={"input": {0: "batch"}},
                opset_version=args.opset,
            )
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

    # 클래스명(한글) -> 영문 슬러그. HF Space가 Detection.name_en 을 채우는 데 이 파일 하나만
    # 신뢰하면 되도록 여기서 명시적으로 채운다(저장소 어디에도 이 매핑이 없으면 서빙이
    # name_en 을 채울 방법이 없어진다).
    name_en_map = {c: KOR_TO_EN.get(c) for c in classes}
    missing_en = [c for c, en in name_en_map.items() if en is None]
    if missing_en:
        log(f"[경고] name_en 매핑이 없는 클래스가 있습니다: {missing_en} — export_classifier.py 상단의 "
            "KOR_TO_EN 딕셔너리(eval_classifier.py의 KOR_TO_EN_SLUG 와 동일하게)를 갱신하세요.")

    # 실제 학습/평가 전처리(train_classifier.py build_transforms 의 eval_tf, eval_classifier.py 동일)는
    # 단순 정사각 리사이즈가 아니라 "짧은 변을 img_size*1.15로 리사이즈 후 img_size로 중앙크롭"이다.
    # 서빙에서 img_size 필드만 보고 '그 값으로 바로 정사각 리사이즈'로 오해하지 않도록 명시한다.
    crop_margin = ckpt.get("crop_margin")
    crop_min_size = ckpt.get("crop_min_size")
    if crop_margin is None or crop_min_size is None:
        log("[경고] ckpt에 crop_margin/crop_min_size 정보가 없습니다(구버전 학습 결과이거나 "
            "학습 시 crops/manifest.json 을 못 찾은 경우). 서빙 시 crop_dataset.py 기본값(margin 0.15, "
            "min_size 24px)을 가정하되, 실제 학습에 쓰인 값을 README/실행 로그로 재확인하세요.")

    meta = {
        "model": ckpt["model"],
        "classes": list(classes),
        "name_en_map": name_en_map,
        "img_size": img_size,
        "mean": list(mean),
        "std": list(std),
        "opset": args.opset,
        "output_shape": list(out_shape),
        "crop_margin": crop_margin,
        "crop_min_size": crop_min_size,
        "resize_strategy": "resize_shorter_side_to_img_size_x1.15_then_center_crop_img_size",
        "interpolation": "bilinear",
        "note": "detections 재분류용. box/severity 는 1단계 YOLO 값을 유지, name/confidence 만 교체. "
                "박스 크롭은 crop_margin/crop_min_size 로, 크롭 후 텐서 변환은 resize_strategy+"
                "interpolation+img_size+mean/std 로 정확히 재현할 것(eval_classifier.py build 참조).",
    }
    (out / "export_meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    log(f"[메타] {out / 'export_meta.json'}")
    log("")
    log("tfjs 변환(edu 앱용)은 이 스크립트에서 구현하지 않음 — 상단 docstring 경로 A/B 참조.")
    log("주의: HF Space 쪽 통합(1단계 YOLO 출력 + 이 분류기 결과를 DiagnosisResult로 조립하는 코드)은 "
        "이 저장소(training/) 밖에서 별도로 구현해야 한다 — 이 스크립트는 export_meta.json 에 필요한 "
        "메타데이터(name_en_map/전처리)만 제공한다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
