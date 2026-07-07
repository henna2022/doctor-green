// 진단용 이미지 공통 유틸 — 카메라 스냅샷/갤러리 업로드 공통 리사이즈
// 최대 변 1280px로 축소 + JPEG 품질 0.8 인코딩 후에만 다음 단계로 넘김

const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.8;

// dataURL(또는 이미지 소스)를 canvas에 그려 최대 변 1280px로 리사이즈한 JPEG dataURL로 변환
export function resizeImageDataUrl(source: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width >= height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas context를 가져올 수 없어요"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
    };
    img.onerror = () => reject(new Error("이미지를 불러올 수 없어요"));
    img.src = source;
  });
}

// 파일(갤러리 업로드)을 리사이즈된 JPEG dataURL로 변환
export function resizeImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const raw = ev.target?.result as string;
        const resized = await resizeImageDataUrl(raw);
        resolve(resized);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(new Error("파일을 읽을 수 없어요"));
    reader.readAsDataURL(file);
  });
}

// sessionStorage 저장 — 쿼터 초과 등 실패 시 false 반환 (사용자 안내는 호출부 책임)
export function safeSetSessionStorage(key: string, value: string): boolean {
  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.warn("sessionStorage 저장 실패:", e);
    return false;
  }
}
