"use client";
import {useEffect,useRef,useState} from "react";

export function QrScanner({onScan,label="Kamerayla QR oku",disabled=false}:{onScan:(value:string)=>void;label?:string;disabled?:boolean}) {
  const [open,setOpen]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const video=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null),scan=useRef(onScan),generation=useRef(0);
  scan.current=onScan;
  const stop=()=>{generation.current++;stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;};
  useEffect(()=>{
    if(!open)return;
    const run=++generation.current;let timer:ReturnType<typeof setTimeout>|undefined;
    const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false);};
    const closeWhenHidden=()=>{if(document.hidden)setOpen(false);};
    document.addEventListener('keydown',closeOnEscape);document.addEventListener('visibilitychange',closeWhenHidden);
    const start=async()=>{
      try {
        if(!navigator.mediaDevices?.getUserMedia)throw Error('Kamera bu tarayıcıda açılamıyor. Siteyi telefonunuzdaki Safari veya Chrome ile HTTPS adresinden açın.');
        const {readQrPixels}=await import('./qr-reader');
        const camera=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
        if(run!==generation.current){camera.getTracks().forEach(track=>track.stop());return;}
        stream.current=camera;
        const player=video.current;if(!player){stop();return;}
        player.srcObject=camera;await player.play();
        const canvas=document.createElement('canvas'),context=canvas.getContext('2d',{willReadFrequently:true});
        if(!context)throw Error('Kamera görüntüsü işlenemedi.');
        const tick=()=>{
          if(run!==generation.current)return;
          if(player.readyState>=2&&player.videoWidth) {
            const scale=Math.min(1,720/Math.max(player.videoWidth,player.videoHeight));
            canvas.width=Math.round(player.videoWidth*scale);canvas.height=Math.round(player.videoHeight*scale);
            context.drawImage(player,0,0,canvas.width,canvas.height);
            const pixels=context.getImageData(0,0,canvas.width,canvas.height);
            const value=readQrPixels(pixels.data,canvas.width,canvas.height);
            if(value){stop();setOpen(false);setNotice(`QR okundu: ${value}`);scan.current(value);return;}
          }
          timer=setTimeout(tick,200);
        };tick();
      }catch(reason) {
        if(run!==generation.current)return;
        stop();const name=reason instanceof Error?reason.name:'';
        setError(name==='NotAllowedError'?'Kamera izni verilmedi. Tarayıcının site ayarlarından kamera izni verebilir veya QR fotoğrafı seçebilirsiniz.':name==='NotFoundError'?'Kamera bulunamadı. QR fotoğrafı seçebilir veya kodu elle girebilirsiniz.':reason instanceof Error?reason.message:'Kamera açılamadı.');
      }
    };void start();
    return()=>{stop();if(timer)clearTimeout(timer);document.removeEventListener('keydown',closeOnEscape);document.removeEventListener('visibilitychange',closeWhenHidden);};
  },[open]);
  const fromPhoto=async(file?:File)=>{
    if(!file)return;setError('');let image:ImageBitmap|undefined;
    try {
      if(file.size>15*1024*1024)throw Error('En fazla 15 MB QR fotoğrafı seçin.');
      const {readQrPixels}=await import('./qr-reader');image=await createImageBitmap(file);
      const scale=Math.min(1,1600/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);
      const context=canvas.getContext('2d');if(!context)throw Error('Fotoğraf işlenemedi.');context.drawImage(image,0,0,canvas.width,canvas.height);
      const value=readQrPixels(context.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height);
      if(!value)throw Error('Fotoğrafta QR kod bulunamadı. Daha net bir fotoğraf seçin.');
      stop();setOpen(false);setNotice(`QR okundu: ${value}`);scan.current(value);
    }catch(reason){setError(reason instanceof Error?reason.message:'QR okunamadı.');}finally{image?.close();}
  };
  return <div className="qr-reader"><button type="button" className="secondary" disabled={disabled} onClick={()=>{setError('');setNotice('');setOpen(true);}}>▦ {label}</button>
    <label className="qr-photo-label">QR fotoğrafı seç<input type="file" accept="image/*" disabled={disabled} onChange={e=>{void fromPhoto(e.target.files?.[0]);e.target.value='';}}/></label>
    {notice&&<p role="status">{notice}</p>}{error&&!open&&<p role="alert">{error}</p>}
    {open&&<div className="qr-overlay" role="dialog" aria-modal="true" aria-label="Telefon kamerasıyla QR oku"><section><div className="history-head"><h3>QR kodu kameraya gösterin</h3><button autoFocus type="button" className="secondary" onClick={()=>{stop();setOpen(false);}}>Kamerayı kapat</button></div><video ref={video} muted playsInline autoPlay/><p>Kodu çerçevenin içinde tutun. Kitap bulunduğunda kamera kapanır; işlemi ekrandan onaylayın.</p>{error&&<p role="alert">{error}</p>}<p className="muted">Görüntü yalnızca cihazınızda işlenir; sunucuya gönderilmez.</p></section></div>}
  </div>;
}
