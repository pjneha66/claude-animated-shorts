// Local Chrome :9228 screencast -> same-origin MJPEG review server.
// Chrome must already be running with --remote-debugging-port=9228.
import http from 'node:http';
const cdp=new URL(process.env.CHROME_CDP_URL||'http://127.0.0.1:9228');
if(!['localhost','127.0.0.1','[::1]'].includes(cdp.hostname))throw new Error('CDP must be loopback');
const targets=await(await fetch(new URL('/json/list',cdp))).json();
const target=targets.find(t=>t.type==='page'&&(!process.env.CDP_PAGE_MATCH||t.url.includes(process.env.CDP_PAGE_MATCH)));
if(!target?.webSocketDebuggerUrl)throw new Error('No matching Chrome page; open Remotion Studio first');
const ws=new WebSocket(target.webSocketDebuggerUrl),clients=new Set();let latest=null,id=0;
await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
const send=(method,params)=>ws.send(JSON.stringify({id:++id,method,params}));
ws.addEventListener('message',event=>{
 const message=JSON.parse(event.data);
 if(message.method==='Page.screencastFrame') {
   latest=Buffer.from(message.params.data,'base64');
   for(const res of clients)if(!res.writableNeedDrain)res.write(Buffer.concat([Buffer.from(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${latest.length}\r\n\r\n`),latest,Buffer.from('\r\n')]));
   send('Page.screencastFrameAck',{sessionId:message.params.sessionId});
 }
});
send('Page.enable',{});send('Page.startScreencast',{format:'jpeg',quality:65,maxWidth:540,maxHeight:960,everyNthFrame:1});
const server=http.createServer((req,res)=>{
 if(req.url==='/stream') {res.writeHead(200,{'Content-Type':'multipart/x-mixed-replace; boundary=frame','Cache-Control':'no-store'});clients.add(res);req.on('close',()=>clients.delete(res));}
 else if(req.url==='/frame.jpg') {res.writeHead(latest?200:503,{'Content-Type':'image/jpeg','Cache-Control':'no-store'});res.end(latest||'Waiting for Chrome');}
 else {res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><title>Local shot review</title><body style="margin:0;background:#171717;display:grid;place-items:center"><img src="/stream" style="max-height:100vh;max-width:100vw"></body>');}
});
ws.addEventListener('close',()=>{for(const res of clients)res.end();server.close();process.exitCode=1;});
server.listen(Number(process.env.PREVIEW_PORT||3334),'0.0.0.0',()=>console.log('Local Chrome shot stream ready'));
process.on('SIGINT',()=>{ws.close();server.close();});
