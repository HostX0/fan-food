/** Serve the exported static site without extra dependencies: npm start */
import http from 'node:http';
import {createReadStream,existsSync,statSync} from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2]||'out'); const port=Number(process.env.PORT)||3000;
if(!existsSync(root)){console.error('Static output not found. Run npm run build first.');process.exit(1);}
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.txt':'text/plain'};
http.createServer((req,res)=>{let decoded;try{decoded=decodeURIComponent(new URL(req.url||'/', 'http://localhost').pathname);}catch{res.writeHead(400).end();return;}let file=path.resolve(root,'.'+decoded);if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end();return;}if(existsSync(file)&&statSync(file).isDirectory())file=path.join(file,'index.html');if(!existsSync(file)){res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});const fallback=path.join(root,'404.html');if(existsSync(fallback))createReadStream(fallback).pipe(res);else res.end('404');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'});createReadStream(file).pipe(res);}).listen(port,()=>console.log(`Fan Food: http://localhost:${port}`));
