import { DiagnosisResult } from "./lib";

export function DetectionOverlay({ image, result }: { image: string; result: DiagnosisResult }) {
  return (
    <div
      className="w-full overflow-hidden relative bg-bg-card"
      style={
        result.image_width && result.image_height
          ? { aspectRatio: `${result.image_width} / ${result.image_height}` }
          : { height: "224px" }
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt="진단 결과" className="w-full h-full object-contain" />

      {result.image_width > 0 &&
        result.image_height > 0 &&
        result.detections?.length > 0 && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox={`0 0 ${result.image_width} ${result.image_height}`}
            preserveAspectRatio="none"
          >
            {result.detections.map((d, i) => {
              const bw = d.box.x2 - d.box.x1;
              const bh = d.box.y2 - d.box.y1;
              const fontSize = Math.max(result.image_width / 28, 24);
              const strokeW = Math.max(result.image_width / 180, 3);
              const labelOutside = d.box.y1 > fontSize * 1.3;
              const labelY = labelOutside
                ? d.box.y1 - fontSize * 0.4
                : d.box.y1 + fontSize;
              const labelBgY = labelOutside ? d.box.y1 - fontSize * 1.3 : d.box.y1;
              return (
                <g key={i}>
                  <rect
                    x={d.box.x1}
                    y={d.box.y1}
                    width={bw}
                    height={bh}
                    fill="none"
                    stroke="#FF4444"
                    strokeWidth={strokeW}
                    rx="4"
                  />
                  <rect
                    x={d.box.x1}
                    y={labelBgY}
                    width={fontSize * 3.2}
                    height={fontSize * 1.3}
                    fill="#FF4444"
                    rx="2"
                  />
                  <text
                    x={d.box.x1 + fontSize * 0.3}
                    y={labelY}
                    fill="white"
                    fontSize={fontSize}
                    fontWeight="bold"
                  >
                    {Math.round(d.confidence * 100)}%
                  </text>
                </g>
              );
            })}
          </svg>
        )}
    </div>
  );
}
