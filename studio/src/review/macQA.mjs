import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
export function runMacQA(files, outDir='out/mac-qa') {
  fs.mkdirSync(outDir,{recursive:true});
  const report={platform:process.platform,stages:[],ok:false};
  const run=(name,command,args)=>{
    const r=spawnSync(command,args,{encoding:'utf8',timeout:120000});
    const stage={name,command,args,status:r.error?'unavailable':r.status===0?'passed':'failed',exit:r.status,output:(r.stdout||'')+(r.stderr||''),error:r.error?.message};report.stages.push(stage);return stage;
  };
  if(process.platform!=='darwin') report.stages.push({name:'platform',status:'unavailable',reason:'Apple Vision and sips require macOS'});
  else {
    // OCR originals, not sheets: small text must not disappear during downsampling.
    if(!files.length) throw new Error('No frame PNGs supplied');
    run('zero-text','swift',[new URL('../../../tools/zero_text.swift', import.meta.url).pathname,...files]);
    for(const [i,file] of files.entries())run(`sips-${i}`,'/usr/bin/sips',['-Z','960',file,'--out',path.join(outDir,`${i}.png`)]);
    run('token-saver',process.env.TOKEN_SAVER_BIN||path.join(os.homedir(),'.local/bin/token-saver'),['vision',outDir]);
    // The installed skill may vary; caller supplies its documented command as a
    // JSON argv array, never a shell string. Missing configuration fails closed.
    if(process.env.OBSIDIAN_CHECKPOINT_ARGV) {
      const argv=JSON.parse(process.env.OBSIDIAN_CHECKPOINT_ARGV);
      if(!Array.isArray(argv)||!argv.length||!argv.every(v=>typeof v==='string')) throw new Error('OBSIDIAN_CHECKPOINT_ARGV must be a JSON argv array');
      run('obsidian',argv[0],argv.slice(1));
    } else report.stages.push({name:'obsidian',status:'unavailable',reason:'Configure OBSIDIAN_CHECKPOINT_ARGV for the installed local CLI'});
  }
  report.ok=report.stages.length>0&&report.stages.every(s=>s.status==='passed');
  fs.writeFileSync(path.join(outDir,'report.json'),JSON.stringify(report,null,2));return report;
}
if(process.argv[1]===new URL(import.meta.url).pathname) {
 const r=runMacQA(process.argv.slice(2));console.log(r);if(!r.ok)process.exitCode=1;
}
