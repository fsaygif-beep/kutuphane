"use client";
import {useEffect,useRef,useState} from "react";

export function QrScanner({onScan,label="Kamerayla QR / barkod oku",disabled=false}:{onScan:(value:string)=>void;label?:string;disabled?:boolean}) {
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
        const {readBarcodePixels}=await import('./barcode-reader');
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
            const scale=Math.min(1,1280/Math.max(player.videoWidth,player.videoHeight));
            canvas.width=Math.round(player.videoWidth*scale);canvas.height=Math.round(player.videoHeight*scale);
            context.drawImage(player,0,0,canvas.width,canvas.height);
            const pixels=context.getImageData(0,0,canvas.width,canvas.height);
            const value=readQrPixels(pixels.data,canvas.width,canvas.height)||readBarcodePixels(pixels.data,canvas.width,canvas.height);
            if(value){stop();setOpen(false);setNotice(`Kod okundu: ${value}`);scan.current(value);return;}
          }
          timer=setTimeout(tick,200);
        };tick();
      }catch(reason) {
        if(run!==generation.current)return;
        stop();const name=reason instanceof Error?reason.name:'';
        setError(name==='NotAllowedError'?'Kamera izni verilmedi. Tarayıcının site ayarlarından kamera izni verebilir veya kodu elle girebilirsiniz.':name==='NotFoundError'?'Kamera bulunamadı. Kodu elle girebilirsiniz.':reason instanceof Error?reason.message:'Kamera açılamadı.');
      }
    };void start();
    return()=>{stop();if(timer)clearTimeout(timer);document.removeEventListener('keydown',closeOnEscape);document.removeEventListener('visibilitychange',closeWhenHidden);};
  },[open]);
  return <div className="qr-reader"><button type="button" className="secondary" disabled={disabled} onClick={()=>{setError('');setNotice('');setOpen(true);}}>▦ {label}</button>
    {notice&&<p role="status">{notice}</p>}{error&&!open&&<p role="alert">{error}</p>}
    {open&&<div className="qr-overlay" role="dialog" aria-modal="true" aria-label="Telefon kamerasıyla QR / barkod oku"><section><div className="history-head"><h3>QR veya barkodu kameraya gösterin</h3><button autoFocus type="button" className="secondary" onClick={()=>{stop();setOpen(false);}}>Kamerayı kapat</button></div><video ref={video} muted playsInline autoPlay/><p>Kodu çerçevenin içinde tutun. Kitap bulunduğunda kamera kapanır; işlemi ekrandan onaylayın.</p>{error&&<p role="alert">{error}</p>}<p className="muted">Görüntü yalnızca cihazınızda işlenir; sunucuya gönderilmez.</p></section></div>}
  </div>;
}

