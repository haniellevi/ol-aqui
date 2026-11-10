from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from urllib.request import Request,urlopen
from pathlib import Path
import json
import sys
config=json.loads(Path(sys.argv[1]).read_text())
html='''<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>OL-AKI · conectar WhatsApp</title><style>[hidden]{display:none!important}body{background:#f7f5f8;color:#4b1248;font:17px system-ui;margin:0;padding:24px}main{max-width:650px;margin:auto;background:white;padding:28px;border-radius:20px}h1{margin:0 0 12px}img{display:block;max-width:100%;width:320px;margin:20px auto}button{background:#ff6a13;color:#4b1248;border:0;border-radius:12px;min-height:52px;padding:12px 20px;font:600 16px system-ui;cursor:pointer}#estado{font-weight:700;padding:12px;background:#f7f5f8;border-radius:12px}small{color:#5e5266}</style><main><h1>OL-AKI · conectar WhatsApp</h1><p>No celular com o número exclusivo do OL-AKI, abra <b>WhatsApp → Dispositivos conectados → Conectar dispositivo</b> e leia o QR Code.</p><p id="estado" role="status">Preparando QR Code...</p><img hidden id="qr" alt="QR Code para conectar o WhatsApp exclusivo do OL-AKI"><button id="atualizar" type="button">Atualizar QR Code</button><p><small>Conexão privada pela sua VPS. Nenhuma mensagem de verificação será enviada nesta etapa.</small></p></main><script>const estado=document.getElementById('estado'),qr=document.getElementById('qr'),btn=document.getElementById('atualizar');let carregando=false,conectado=false;async function gerar(automatico=false){if(carregando||conectado)return;carregando=true;btn.disabled=true;try{let r=await fetch(automatico?'/qr-atual':'/qr'),d=await r.json();if(d.base64){qr.src=d.base64;qr.hidden=false;estado.textContent='Leia o QR Code no WhatsApp do número exclusivo.';}else{estado.textContent=d.conectado?'WhatsApp conectado. Você pode voltar ao Codex.':'QR Code ainda não disponível. Toque em Atualizar QR Code.';}}catch{estado.textContent='Não foi possível obter o QR Code. Tente atualizar.';}finally{carregando=false;btn.disabled=false;}}btn.onclick=()=>gerar(false);gerar();const timer=setInterval(async()=>{try{let d=await(await fetch('/estado')).json();if(d.conectado){conectado=true;estado.textContent='WhatsApp conectado. Você pode voltar ao Codex.';qr.hidden=true;btn.hidden=true;clearInterval(timer);}else{await gerar(true);}}catch{}},3000);</script></html>'''
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  if self.headers.get('Host') not in ('127.0.0.1:3111','localhost:3111'):self.send_error(403);return
  if self.path=='/':data=html.encode();mime='text/html; charset=utf-8'
  elif self.path in ['/qr','/qr-atual','/estado']:
   endpoint='/instance/'+('connect' if self.path in ['/qr','/qr-atual'] else 'connectionState')+'/'+config['EVOLUTION_INSTANCE']
   try:
    if self.path=='/qr-atual':
     with urlopen(Request('http://127.0.0.1:3110/instance/connectionState/'+config['EVOLUTION_INSTANCE'],headers={'apikey':config['EVOLUTION_API_KEY'],'Origin':config['EVOLUTION_URL']}),timeout=10) as r:state=json.load(r)
     if state.get('instance',{}).get('state')!='connecting':raise ValueError('Sessão não está aguardando QR')
    with urlopen(Request('http://127.0.0.1:3110'+endpoint,headers={'apikey':config['EVOLUTION_API_KEY'],'Origin':config['EVOLUTION_URL']}),timeout=15) as r:d=json.load(r)
    data=json.dumps({'base64':d.get('base64'),'conectado':d.get('instance',{}).get('state')=='open'}).encode()
   except Exception:data=b'{"erro":true}'
   mime='application/json'
  else:self.send_error(404);return
  self.send_response(200);self.send_header('Content-Type',mime);self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.end_headers();self.wfile.write(data)
ThreadingHTTPServer(('127.0.0.1',3111),Handler).serve_forever()
