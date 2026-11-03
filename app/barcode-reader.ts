import {BinaryBitmap,HybridBinarizer,RGBLuminanceSource,MultiFormatOneDReader,DecodeHintType,BarcodeFormat} from '@zxing/library';
const hints=new Map();
hints.set(DecodeHintType.POSSIBLE_FORMATS,[BarcodeFormat.EAN_13,BarcodeFormat.EAN_8,BarcodeFormat.CODE_128,BarcodeFormat.CODE_39,BarcodeFormat.CODE_93,BarcodeFormat.UPC_A,BarcodeFormat.UPC_E,BarcodeFormat.ITF,BarcodeFormat.CODABAR]);
hints.set(DecodeHintType.TRY_HARDER,true);
export function readBarcodePixels(data:Uint8ClampedArray,width:number,height:number):string|null {
  const gray=new Uint8ClampedArray(width*height);
  for(let i=0;i<gray.length;i++)gray[i]=(data[i*4]+2*data[i*4+1]+data[i*4+2])>>2;
  const reader=new MultiFormatOneDReader(hints);
  try{return reader.decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(gray,width,height))),hints).getText();}catch{return null;}finally{reader.reset();}
}
