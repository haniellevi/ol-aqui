#!/usr/bin/env python3
"""Ponte local: aceita apenas ticket e consulta o perfil do número autorizado."""
import hmac
import json
import os
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler

class SemRedirecao(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

opener = build_opener(SemRedirecao())

def post(url, corpo, headers):
    request = Request(url, data=json.dumps(corpo).encode(), headers={'Content-Type': 'application/json', **headers}, method='POST')
    with opener.open(request, timeout=8) as resposta:
        data = resposta.read(16385)
        if len(data) > 16384:
            raise ValueError('resposta grande')
        resultado = json.loads(data)
        if not isinstance(resultado, dict):
            raise ValueError('resposta inválida')
        return resultado

def consultar(ticket):
    callback = os.environ['LOJA_IA_CALLBACK_URL']
    destino = urlsplit(callback)
    if destino.scheme != 'https' or not destino.hostname or destino.username or destino.password or destino.query or destino.fragment:
        raise ValueError('callback inválido')
    info = post(callback, {'ticket': ticket}, {'Authorization': 'Bearer ' + os.environ['LOJA_IA_CALLBACK_SEGREDO']})
    numero = info.get('numero')
    if not isinstance(numero, str) or not re.fullmatch(r'55[1-9][0-9]9?[0-9]{8}', numero):
        raise ValueError('ticket recusado')
    perfil = post('http://127.0.0.1:8087/chat/fetchProfile/olaki-verificacao', {'number': numero}, {'apikey': os.environ['EVOLUTION_API_KEY'], 'Origin': os.environ['EVOLUTION_URL']})
    if perfil.get('isBusiness') is not True:
        return {}
    return {saida: valor[:limite] for entrada, saida, limite in [('name', 'nome', 80), ('description', 'descricao', 600), ('website', 'site', 2048), ('picture', 'foto', 2048)] if isinstance((valor := perfil.get(entrada)), str) and valor.strip()}

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass
    def do_POST(self):
        segredo = os.environ.get('LOJA_IA_PERFIL_SEGREDO', '')
        fornecido = self.headers.get('Authorization', '')
        if self.path != '/perfil-loja' or len(segredo) < 32 or not hmac.compare_digest(fornecido, 'Bearer ' + segredo):
            self.send_error(403); return
        try:
            tamanho = int(self.headers.get('Content-Length', '0'))
            if tamanho < 1 or tamanho > 1024: raise ValueError('tamanho')
            corpo = json.loads(self.rfile.read(tamanho))
            if not isinstance(corpo, dict) or set(corpo) != {'ticket'} or not isinstance(corpo['ticket'], str) or not re.fullmatch(r'[0-9a-fA-F-]{36}', corpo['ticket']): raise ValueError('ticket')
            resposta = json.dumps(consultar(corpo['ticket'])).encode()
            self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Cache-Control', 'no-store'); self.send_header('Content-Length', str(len(resposta))); self.end_headers(); self.wfile.write(resposta)
        except Exception:
            self.send_error(503)

if __name__ == '__main__':
    ThreadingHTTPServer(('127.0.0.1', 8091), Handler).serve_forever()
