import jsQR from "jsqr";
export function readQrPixels(data:Uint8ClampedArray,width:number,height:number) {
  const value=jsQR(data,width,height,{inversionAttempts:"attemptBoth"})?.data.trim();
  return value && value.length<=2048 ? value : null;
}
