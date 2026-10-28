/* Runtime services for build-time translated WIPI programs.
 * No ARM instruction decoder or interpreter is included here.
 */
export class WipiRuntime {
 constructor(seed,{present=()=>{},storage=null}={}){
  this.seed=seed;this.r=new Uint32Array(16);this.program=[];this.armProgram=[];this.thumb=true;this.n=0;this.z=0;this.c=0;this.v=0;
  const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  this.codeBase=seed.image_base||0x100000;this.image=bytes(seed.image);this.heap=new Uint8Array(seed.heap_size||8*1024*1024);this.heap.set(bytes(seed.heap));this.stack=new Uint8Array(1024*1024);
  this.regions=[[this.codeBase,this.image],[0x4000000,this.heap],[0x7000000,this.stack],...(seed.segments||[]).map(s=>[s.base,bytes(s.data)])].map(([base,data])=>({base,data,view:new DataView(data.buffer,data.byteOffset,data.byteLength)}));
  this.cursor=seed.heap_cursor;this.allocations=new Map();this.freeBlocks=[];this.stubs=seed.stubs;this.resources=new Map(Object.entries(seed.resources).map(([n,b])=>[n,bytes(b)]));
  this.handles=new Map();this.timers=new Map();this.pending=new Map();this.files=new Map();this.fds=new Map();this.present=present;this.storage=storage;this.time=1000;this.screen=0;this.frames=0;this.calls=[];
 }
 region(a,size){a>>>=0;for(const x of this.regions)if(a>=x.base&&a+size<=x.base+x.data.length)return x;throw Error('Invalid translated memory access: 0x'+a.toString(16));}
 u8(a){const x=this.region(a,1);return x.view.getUint8(a-x.base);}
 i8(a){const x=this.region(a,1);return x.view.getInt8(a-x.base);}
 u16(a){const x=this.region(a,2);return x.view.getUint16(a-x.base,true);}
 i16(a){const x=this.region(a,2);return x.view.getInt16(a-x.base,true);}
 u32(a){const x=this.region(a,4);return x.view.getUint32(a-x.base,true);}
 w8(a,v){const x=this.region(a,1);x.view.setUint8(a-x.base,v);}
 w16(a,v){const x=this.region(a,2);x.view.setUint16(a-x.base,v,true);}
 w32(a,v){const x=this.region(a,4);x.view.setUint32(a-x.base,v,true);}
 read(a,n){const x=this.region(a,n);return x.data.slice(a-x.base,a-x.base+n);}
 write(a,data){const x=this.region(a,data.length);x.data.set(data,a-x.base);}
 words(a,...v){v.forEach((n,i)=>this.w32(a+4*i,n));}
 str(a){let s='';for(let i=0;i<512&&a;i++){const c=this.u8(a+i);if(!c)break;s+=String.fromCharCode(c);}return s;}
 alloc(n){if(n<0||n>this.heap.length)throw Error('Invalid allocation size');n=(n+7)&~7;let p;const i=this.freeBlocks.findIndex(b=>b.size>=n);if(i>=0){const block=this.freeBlocks[i];p=block.p;block.p+=n;block.size-=n;if(!block.size)this.freeBlocks.splice(i,1);this.heap.fill(0,p-0x4000000,p-0x4000000+n);}else{p=this.cursor;this.cursor+=n;if(this.cursor>0x4000000+this.heap.length)throw Error('WIPI allocation limit');}this.allocations.set(p,n);return p;}
 free(p){const size=this.allocations.get(p);if(size){this.allocations.delete(p);this.freeBlocks.push({p,size});this.freeBlocks.sort((a,b)=>a.p-b.p);for(let i=0;i<this.freeBlocks.length-1;){const a=this.freeBlocks[i],b=this.freeBlocks[i+1];if(a.p+a.size===b.p){a.size+=b.size;this.freeBlocks.splice(i+1,1);}else i++;}}}
 indirect(n){const p=this.alloc(n+12);this.words(p,p+4,n,0);return p;}
 data(p){return this.u32(p)+8;}
 fb(w,h){if(w>1024||h>1024)throw Error('Invalid framebuffer dimensions');const pixels=this.indirect(w*h*2),fb=this.indirect(20);this.words(this.data(fb),w,h,w*2,16,pixels);return fb;}
 framebuffer(p){const a=this.data(p);return {w:this.u32(a),h:this.u32(a+4),stride:this.u32(a+8),pixels:this.data(this.u32(a+16))};}
 nz(value){value>>>=0;this.n=value>>>31;this.z=+(value===0);return value;}
 add(a,b,flags=false){a>>>=0;b>>>=0;const sum=a+b,result=sum>>>0;if(flags){this.nz(result);this.c=+(sum>0xffffffff);this.v=((~(a^b)&(a^result))>>>31);}return result;}
 sub(a,b,flags=false){a>>>=0;b>>>=0;const result=(a-b)>>>0;if(flags){this.nz(result);this.c=+(a>=b);this.v=(((a^b)&(a^result))>>>31);}return result;}
 adc(a,b,flags=true){a>>>=0;b>>>=0;const sum=a+b+this.c,result=sum>>>0;if(flags){this.nz(result);this.c=+(sum>0xffffffff);this.v=((~(a^b)&(a^result))>>>31);}return result;}
 sbc(a,b,flags=true){a>>>=0;b>>>=0;const sum=a-b-(1-this.c),result=sum>>>0;if(flags){this.nz(result);this.c=+(sum>=0);this.v=(((a^b)&(a^result))>>>31);}return result;}
 rrx(value,flags){const result=(this.c<<31)|(value>>>1);if(flags){this.c=value&1;this.nz(result);}return result>>>0;}
 shift(kind,value,amount,flags){value>>>=0;let carry=this.c,result=value;if(amount){if(kind===0){carry=amount<=32?(value>>>(32-amount))&1:0;result=amount<32?value<<amount:0;}else if(kind===1){carry=amount<=32?(value>>>(amount-1))&1:0;result=amount<32?value>>>amount:0;}else if(kind===2){carry=amount<32?(value>>>(amount-1))&1:value>>>31;result=(value|0)>>Math.min(amount,31);}else{const n=amount&31;result=n?(value>>>n)|(value<<(32-n)):value;carry=result>>>31;}}if(flags){this.nz(result);this.c=carry;}return result>>>0;}
 cond(k){return [this.z,!this.z,this.c,!this.c,this.n,!this.n,this.v,!this.v,this.c&&!this.z,!this.c||this.z,this.n===this.v,this.n!==this.v,!this.z&&this.n===this.v,this.z||this.n!==this.v][k];}
 jump(target){target>>>=0;this.thumb=!!(target&1);return target&(this.thumb?~1:~3);}
 call(target,args=[],stackTop=0x70ff000){
  const r=this.r;r[13]=stackTop;r[14]=0x3000001;for(let i=0;i<4;i++)r[i]=args[i]||0;args.slice(4).forEach((a,i)=>this.w32(r[13]+i*4,a));return this.execute(this.jump(target));
 }
 resume(state){this.r.set(state.regs);[this.n,this.z,this.c,this.v,this.thumb]=state.flags;return this.execute(state.pc);}
 execute(pc){
  const r=this.r;let budget=3000000;
  while(pc!==0x3000000){
   if(this.trace){this.trace.push([pc,this.thumb]);if(this.trace.length>40)this.trace.shift();}
   if(--budget===0)throw Error('Translated call block budget exceeded');
   const stub=this.stubs[String(pc)];
   if(stub){
    const args=Array.from(r.slice(0,4));this.calls.push(stub);if(this.calls.length>100)this.calls.shift();
    try{const value=this.service(stub,args);if(value!==undefined)r[0]=value>>>0;}catch(error){if(error.javaException&&this.unwindException){const next=this.unwindException(error.javaException);if(next!==null){pc=next;continue;}}if(error.yieldMs!==undefined){r[0]=0;const next=this.jump(r[14]);error.state={regs:r.slice(),flags:[this.n,this.z,this.c,this.v,this.thumb],pc:next};}throw error;}
    pc=this.jump(r[14]);continue;
   }
   const fn=this.thumb?this.program[(pc-this.codeBase)>>>1]:this.armProgram[(pc-this.codeBase)>>>2];
   if(!fn)throw Error('Missing compiled block: 0x'+pc.toString(16));pc=fn(pc)>>>0;
  }return r[0];
 }

 service(name,args){
  const [a,b,c,d]=args,extra=Array.from({length:5},(_,i)=>this.u32(this.r[13]+i*4));
  const table=name.slice(0,name.indexOf('.')),field=name.slice(name.indexOf('.')+1);
  if(table==='WIPICKnlInterface'){
   if(field==='current_time'){this.r[1]=0;return this.time;}
   if(field==='alloc'||field==='calloc')return a?this.indirect(a):0;
   if(field==='free'){this.free(a);return 0;}
   if(field==='get_resource_id'){const n=this.str(a).replace(/^\//,'');const data=this.resources.get(n);if(b)this.w32(b,data?.length||0);if(!data)return -12;const id=this.alloc(4);this.handles.set(id,n);return id;}
   if(field==='get_resource'){const data=this.resources.get(this.handles.get(a));if(!data)return -9;if(data.length>c)return -1;this.write(this.data(b),data);return 0;}
   if(field==='def_timer'){this.pending.delete(a);this.timers.set(a,b);this.w32(a,b);return 0;}
   if(field==='set_timer'){if(this.pending.has(a))return -5;this.pending.set(a,{callback:this.timers.get(a),due:this.time+b+c*4294967296,param:d});return 0;}
   if(field==='unset_timer'){this.pending.delete(a);return 0;}
   if(field==='get_system_property'){const value={RSSILEVEL:'30',BATTERYLEVEL:'100',ANNUN_CALL:'0',ANNUN_ALARM:'0',ANNUN_SILENT:'0',ANNUN_SMS:'0',ANNUN_SECURITY:'0'}[this.str(a)];if(value===undefined)return -9;if(value.length+1>c)return -18;this.write(b,Uint8Array.from([...value].map(c=>c.charCodeAt(0)).concat(0)));return 0;}
   if(field==='get_access_level')return 0;
   if(field==='get_exec_names')return -12; // No handset program registry exists in the browser.
   if(field==='printk')return 0;
  }
  if(table==='WIPICGraphicsInterface'){
   if(field==='get_screen_framebuffer')return this.screen||=this.fb(this.seed.width,this.seed.height);
   if(field==='create_offscreen_framebuffer')return this.fb(a,b);
   if(field==='destroy_offscreen_framebuffer'||field==='destroy_image'){if(a){const data=this.data(a);this.free(this.u32(data+16));this.free(a);}return 0;}
   if(field==='get_display_info'){this.words(b,16,16,this.seed.width,this.seed.height,this.seed.width*2,1,0xf800,0x1f,0x7e0);return 1;}
   if(field==='init_context'){this.write(a,new Uint8Array(56));return 0;}
   if(field==='get_pixel_from_rgb')return ((a>>3)<<11)|((b>>2)<<5)|(c>>3);
   if(field==='set_context'){const offset={1:12,2:16,3:20,4:24,5:32,6:36,8:48,9:52}[b];if(offset!==undefined){this.w32(a+offset,c);return 0;}if(b===0){if(c)for(let i=0;i<4;i++)this.w16(a+4+i*2,this.u32(c+i*4));this.w32(a,c?this.u32(a)|1:this.u32(a)&~1);return 0;}throw Error('Unsupported WIPI graphics context '+b);}
   if(field==='fill_rect'){const [height,ctx]=extra,fb=this.framebuffer(a),x=b|0,y=c|0,color=this.u32(ctx+12);for(let yy=Math.max(0,y);yy<Math.min(fb.h,y+(height|0));yy++)for(let xx=Math.max(0,x);xx<Math.min(fb.w,x+(d|0));xx++)this.w16(fb.pixels+yy*fb.stride+xx*2,color);return 0;}
   if(['copy_area','copy_frame_buffer','draw_image'].includes(field)){
    let height,source,sx,sy,ctx;if(field==='copy_area'){[height,sx,sy,ctx]=extra;source=a;}else [height,source,sx,sy,ctx]=extra;
    const dst=this.framebuffer(a),src=this.framebuffer(source),data=this.read(src.pixels,src.stride*src.h),dx=b|0,dy=c|0; sx|=0;sy|=0;height|=0;
    let clip=[0,0,dst.w,dst.h];if(ctx&&(this.u32(ctx)&1))clip=Array.from({length:4},(_,i)=>this.i16(ctx+4+i*2));
    for(let y=Math.max(0,-dy,-sy,clip[1]-dy);y<Math.min(height,dst.h-dy,src.h-sy,clip[3]-dy);y++){
     const lo=Math.max(0,-dx,-sx,clip[0]-dx),hi=Math.min(d|0,dst.w-dx,src.w-sx,clip[2]-dx);
     if(hi>lo){const start=(sy+y)*src.stride+(sx+lo)*2;this.write(dst.pixels+(dy+y)*dst.stride+(dx+lo)*2,data.subarray(start,start+(hi-lo)*2));}
    }return 0;
   }
   if(field==='flush_lcd'){this.frames++;const fb=this.framebuffer(b);this.present(fb,this.read(fb.pixels,fb.stride*fb.h));return 0;}
   if(field==='create_image'){
    const data=this.read(this.data(b)+c,d),view=new DataView(data.buffer);if(data[0]!==66||data[1]!==77)throw Error('Unsupported WIPI image format');
    const width=view.getInt32(18,true),signedH=view.getInt32(22,true),height=Math.abs(signedH),bits=view.getUint16(28,true),offset=view.getUint32(10,true),stride=((width*bits+31)>>5)*4;
    if(view.getUint32(30,true)!==0||![8,24,32].includes(bits))throw Error('Unsupported WIPI BMP encoding');
    const fb=this.fb(width,height),dst=this.framebuffer(fb),palette=14+view.getUint32(14,true);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){let pos=offset+(signedH>0?height-y-1:y)*stride+x*(bits>>3);if(bits===8)pos=palette+data[pos]*4;const blue=data[pos],green=data[pos+1],red=data[pos+2];this.w16(dst.pixels+y*dst.stride+x*2,((red>>3)<<11)|((green>>2)<<5)|(blue>>3));}
    const image=this.indirect(72);this.write(this.data(image),this.read(this.data(fb),20));this.w32(a,image);return 1;
   }
  }
  if(table==='WIPICFsInterface'){
   if(field==='open'){const n=this.str(a);if(!this.files.has(n)){let stored;try{stored=this.storage?.getItem(this.seed.slug+':'+n);}catch{}if(stored)this.files.set(n,Uint8Array.from(JSON.parse(stored)));}if(!this.files.has(n)&&b===1)return -12;if(b===4||!this.files.has(n))this.files.set(n,new Uint8Array());const fd=this.alloc(4);this.fds.set(fd,{name:n,pos:0,mode:b});return fd;}
   const fd=this.fds.get(a);if(!fd)return -2;const data=this.files.get(fd.name);
   if(field==='close'){this.fds.delete(a);this.free(a);return 0;}
   if(field==='read'){if(fd.mode===2||fd.mode===4)return -24;const chunk=data.subarray(fd.pos,fd.pos+c);if(!chunk.length&&c)return -23;this.write(b,chunk);fd.pos+=chunk.length;return chunk.length;}
   if(field==='write'){if(fd.mode===1)return -24;const end=fd.pos+c;if(end>1024*1024)return -1;const target=new Uint8Array(Math.max(end,data.length));target.set(data);target.set(this.read(b,c),fd.pos);this.files.set(fd.name,target);fd.pos=end;try{this.storage?.setItem(this.seed.slug+':'+fd.name,JSON.stringify(Array.from(target)));}catch{}return c;}
   if(field==='seek'){if(c>2)return -1;const pos=[0,fd.pos,data.length][c]+(b|0);if(pos<0)return -1;return fd.pos=pos;}
  }
  if(table==='WIPICMediaInterface'){
   if(field==='clip_create')return this.alloc(16);
   if(field==='clip_put_data')return c;
   if(['get_volume','clip_get_volume'].includes(field))return 5;
   if(field==='clip_free'){this.free(a);return 0;}
   if(['stop','pause','play','resume','clip_set_volume','vibrator'].includes(field))return 0;
  }
  if(table==='misc_interface'&&field==='unknown_0')return 0;
  throw Error('WIPI service not implemented: '+name);
 }
 tick(time){this.time=time;for(const [id,t] of [...this.pending])if(t.due<=time){this.pending.delete(id);this.call(t.callback,[id,t.param]);}}
}
