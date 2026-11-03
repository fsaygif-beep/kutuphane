import test from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import {readQrPixels} from '../app/qr-reader.ts';
import JsBarcode from 'jsbarcode';
import {readBarcodePixels} from '../app/barcode-reader.ts';

test('camera barcode decoder reads Code128 and ISBN EAN13 and rejects a blank frame',()=>{
 for(const [format,value] of [['CODE128','00001234567'],['EAN13','9789750718533']]){
  const encoded={};JsBarcode(encoded,value,{format,displayValue:false});
  const bits=encoded.encodings.map(e=>e.data).join(''),scale=3,margin=40,width=bits.length*scale+margin*2,height=160,pixels=new Uint8ClampedArray(width*height*4).fill(255);
  for(let x=0;x<bits.length;x++)if(bits[x]==='1')for(let xx=0;xx<scale;xx++)for(let y=15;y<height-15;y++){const i=(y*width+margin+x*scale+xx)*4;pixels[i]=pixels[i+1]=pixels[i+2]=0;}
  assert.equal(readBarcodePixels(pixels,width,height),value);
 }
 assert.equal(readBarcodePixels(new Uint8ClampedArray(100*100*4).fill(255),100,100),null);
});

test('phone scanner decodes a generated library QR without losing leading zeros',()=>{
  const code=QRCode.create('00001234567',{errorCorrectionLevel:'M'}),scale=8,margin=4;
  const size=(code.modules.size+margin*2)*scale,rgba=new Uint8ClampedArray(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const mx=Math.floor(x/scale)-margin,my=Math.floor(y/scale)-margin;
    const black=mx>=0&&my>=0&&mx<code.modules.size&&my<code.modules.size&&code.modules.get(my,mx);
    const index=(y*size+x)*4;rgba[index]=rgba[index+1]=rgba[index+2]=black?0:255;rgba[index+3]=255;
  }
  assert.equal(readQrPixels(rgba,size,size),'00001234567');
  for(let i=0;i<rgba.length;i+=4)rgba[i]=rgba[i+1]=rgba[i+2]=255-rgba[i];
  assert.equal(readQrPixels(rgba,size,size),'00001234567');
});
test('blank frames do not select a book or produce a false scan',()=>{
  const pixels=new Uint8ClampedArray(100*100*4).fill(255);assert.equal(readQrPixels(pixels,100,100),null);
});
