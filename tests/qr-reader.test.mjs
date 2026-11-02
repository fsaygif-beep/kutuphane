import test from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import {readQrPixels} from '../app/qr-reader.ts';

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
