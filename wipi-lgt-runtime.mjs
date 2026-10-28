/* LGT services for statically translated Java AOT game code. Beta compatibility. */
import {WipiRuntime} from './wipi-runtime.mjs';
import {decodePNG} from './wipi-png.mjs';
import {RasterGraphics} from './wipi-raster.mjs';
export class LgtRuntime extends WipiRuntime {
 constructor(seed,options){super(seed,options);this.stubCursor=0x3000010;this.classes=new Map();this.classObjects=new Map();this.objects=new Map();this.imports=[];this.exceptionFrames=[];this.exceptionFloor=0;this.pendingException=0;}
 stub(name){for(const [p,n] of Object.entries(this.stubs))if(n===name)return Number(p)|1;const p=this.stubCursor;this.stubCursor+=4;this.stubs[String(p)]=name;return p|1;}
 makeClass(name){
  if(this.classes.has(name))return this.classes.get(name);
  const generated=this.seed.classes?.[name];
  const raw=generated?Number(generated.class_address):this.alloc(12),desc=generated?Number(generated.descriptor_address):this.alloc(80),compilerVtable=generated?this.u32(desc+12):0,compilerCount=generated?this.u16(desc+38):0,vtable=this.alloc(1024),fields=this.alloc(2048),object=this.alloc(12);
  const compilerTargets=compilerVtable?Array.from({length:compilerCount},(_,i)=>this.u32(compilerVtable+(i+1)*4)):[];
  this.words(raw,vtable,0,desc);this.words(object,vtable,0,fields);this.w32(fields+16,generated?0:5);
  const nameData=new TextEncoder().encode(name+'\0'),namePointer=this.alloc(nameData.length);this.write(namePointer,nameData);this.w32(fields+8,namePointer);
  const cls={name,raw,desc,vtable,fields,object,methods:new Map(),generated};this.classes.set(name,cls);this.classObjects.set(object,cls);this.words(vtable,raw);
  if(generated){this.w16(desc+26,3);this.w32(desc+64,fields);}
  const parentPtr=generated?this.u32(desc+16):0;
  const parentName=generated?(parentPtr?this.str(this.u8(desc+36)&2?parentPtr:this.u32(this.u32(parentPtr+8)+8)):''):({'org/kwis/msp/media/Clip':'org/kwis/msp/media/BaseClip','java/io/PrintStream':'java/io/OutputStream','org/kwis/msp/lwc/AnnunciatorComponent':'org/kwis/msp/lwc/Component','org/kwis/msp/lwc/TextFieldComponent':'org/kwis/msp/lwc/TextComponent','org/kwis/msp/lwc/TextComponent':'org/kwis/msp/lwc/Component','java/io/DataInputStream':'java/io/InputStream','java/io/ByteArrayInputStream':'java/io/InputStream','java/io/DataOutputStream':'java/io/OutputStream','java/io/ByteArrayOutputStream':'java/io/OutputStream'}[name]||'java/lang/Object');
  if(parentName&&parentName!==name){const parent=generated&&!(this.u8(desc+36)&2)?this.generatedClass(parentPtr):this.makeClass(parentName);cls.parent=parent;for(let i=0;i<128;i++){const target=this.u32(parent.vtable+(i+1)*4);if(target)this.w32(vtable+(i+1)*4,target);}for(const [key,slot] of parent.methods)cls.methods.set(key,slot);}
  const abi=this.seed.java_abi[name];
  for(const method of abi?.vtable||[]){cls.methods.set(method.name+method.descriptor,method.index);this.w32(vtable+(method.index+1)*4,this.member(name,method.name,method.descriptor));}
  if(name==='java/lang/Runtime'){cls.methods.set('freeMemory()J',11);this.w32(vtable+48,this.member(name,'freeMemory','()J'));}
  if(name==='java/lang/String')for(const [slot,method,sig] of [[22,'indexOf','(II)I'],[25,'indexOf','(Ljava/lang/String;)I'],[26,'indexOf','(Ljava/lang/String;I)I'],[27,'substring','(I)Ljava/lang/String;']]){cls.methods.set(method+sig,slot);this.w32(vtable+(slot+1)*4,this.member(name,method,sig));}
  if(name==='java/io/OutputStream'){cls.methods.set('flush()V',13);this.w32(vtable+56,this.member(name,'flush','()V'));}
  if(name==='java/io/DataOutputStream'){cls.methods.set('writeUTF(Ljava/lang/String;)V',24);this.w32(vtable+100,this.member(name,'writeUTF','(Ljava/lang/String;)V'));}
  if(name==='java/io/DataInputStream')for(const [slot,method,sig] of [[22,'readBoolean','()Z'],[26,'readUnsignedShort','()I'],[27,'readChar','()C'],[29,'readLong','()J'],[32,'readUTF','()Ljava/lang/String;']]){cls.methods.set(method+sig,slot);this.w32(vtable+(slot+1)*4,this.member(name,method,sig));}
  if(!generated)for(const method of this.foreignDeclarations?.get(name)||[]){const key=method.name+method.sig;if(!cls.methods.has(key)){const slot=Math.max(this.seed.java_abi[name]?.vtable_size||10,...cls.methods.values())+1;cls.methods.set(key,slot);this.w32(vtable+(slot+1)*4,this.member(name,method.name,method.sig));}}
  if(generated)for(const method of generated.methods){if(method.name.startsWith('<'))continue;let slot=cls.methods.get(method.name+method.descriptor);if(slot===undefined&&method.name==='showNotify')slot=14;if(slot===undefined&&method.name==='run')slot=this.seed.java_abi['java/lang/Runnable']?.vtable?.find(m=>m.name==='run')?.index;if(slot!==undefined){cls.methods.set(method.name+method.descriptor,slot);this.w32(vtable+(slot+1)*4,Number(method.address));}}
  compilerTargets.forEach((target,i)=>{if(target)this.w32(vtable+(i+1)*4,target);});
  this.w32(object,name==='java/lang/Class'?vtable:this.makeClass('java/lang/Class').vtable);
  if(name==='java/lang/System')this.w32(fields+20,this.instantiate(this.makeClass('java/io/PrintStream')));
  return cls;
 }
 invoke(target,args=[]){const regs=this.r.slice(),flags=[this.n,this.z,this.c,this.v,this.thumb],stack=this.r[13]-0x1000,floor=this.exceptionFloor;this.exceptionFloor=this.exceptionFrames.length;let result;try{result=this.call(target,args,stack);}finally{this.r.set(regs);[this.n,this.z,this.c,this.v,this.thumb]=flags;this.exceptionFloor=floor;}return result;}
 raiseJava(name){const error=Error(name);error.javaException=this.instantiate(this.makeClass(name));throw error;}
 unwindException(pointer){if(this.exceptionFrames.length<=this.exceptionFloor)return null;const frame=this.exceptionFrames.at(-1);this.r.set(frame.regs);[this.n,this.z,this.c,this.v,this.thumb]=frame.flags;this.pendingException=pointer;return this.jump(frame.regs[14]);}
 instantiate(cls){const object=this.alloc(12),fields=this.alloc(Math.max(128,cls.generated?this.u16(cls.desc+24)*4:64));this.words(object,cls.vtable,0,fields);this.objects.set(object,{cls});const callbacks=[];for(let current=cls;current;current=current.parent){const callback=current.generated?this.u32(current.vtable+4):0;if(callback)callbacks.unshift(callback);}for(const callback of callbacks)this.invoke(callback,[object]);return object;}

 array(name,length){const cls=this.makeClass(name),size=({'Z':1,'B':1,'C':2,'S':2,'J':8,'D':8}[name.slice(1)]||4),fields=this.alloc(8+size*length),object=this.alloc(12);this.words(object,cls.vtable,0,fields);this.w32(fields,length);this.objects.set(object,{cls,size,array:true,length,data:fields+(size===8?8:4)});return object;}
 javaString(value){const object=this.instantiate(this.makeClass('java/lang/String'));this.objects.get(object).value=value;return object;}
 readByte(pointer){const object=this.objects.get(pointer);if(object.source)return this.readByte(object.source);if(object.data)return object.pos<object.data.length?object.data[object.pos++]:-1;return this.invoke(this.u32(this.u32(pointer)+44),[pointer]);}
 writeBytes(pointer,bytes){const obj=this.objects.get(pointer);if(obj.source)return this.writeBytes(obj.source,bytes);if(obj.buffer){obj.buffer.push(...bytes);return;}if(obj.file){const f=obj.file,data=this.files.get(f.name),target=new Uint8Array(Math.max(data.length,f.pos+bytes.length));target.set(data);target.set(bytes,f.pos);this.files.set(f.name,target);f.pos+=bytes.length;return;}for(const byte of bytes)this.invoke(this.u32(this.u32(pointer)+44),[pointer,byte]);}
 graphics(image){const object=this.instantiate(this.makeClass('org/kwis/msp/lcdui/Graphics'));this.objects.get(object).graphics=new RasterGraphics(image);return object;}
 member(className,name,sig){return this.stub('java|'+className+'|'+name+'|'+sig);}
 generatedClass(raw){const desc=this.u32(raw+8),name=this.str(this.u32(desc+8));if(!this.seed.classes[name])this.seed.classes[name]={class_address:raw,descriptor_address:desc,methods:[]};return this.makeClass(name);}
 link(params){
  const [records,...p]=params,count=this.u32(records);
  this.foreignDeclarations=new Map();
  for(let i=0;i<count;i++){const rec=records+4+i*24,name=this.str(this.u32(rec)),methods=[];for(const kind of [2,3]){const offset=this.u16(rec+4+kind*4),n=this.u16(rec+6+kind*4);for(let j=0;j<n;j++){const k=offset+j;methods.push({name:this.str(this.u32(p[kind]+k*8)),sig:this.str(this.u32(p[kind]+k*8+4))});}}this.foreignDeclarations.set(name,methods);}

  for(let i=0;i<count;i++){
   const record=records+4+i*24,name=this.str(this.u32(record)),cls=this.makeClass(name);this.imports.push(name);
   for(let kind=0;kind<5;kind++){
    const offset=this.u16(record+4+kind*4),count=this.u16(record+6+kind*4);
    for(let j=0;j<count;j++){
     const index=offset+j,member=this.str(this.u32(p[kind]+index*8)),sig=this.str(this.u32(p[kind]+index*8+4));
     if(kind<2){this.w16(p[5+kind]+index*2,j);continue;}
     if(kind===4){this.w32(p[9]+index*4,j<2?this.stub('class|'+name):this.member(name,member,sig));continue;}
     const key=member+sig;
     if(!cls.methods.has(key)){const slot=Math.max(this.seed.java_abi[name]?.vtable_size||10,...cls.methods.values())+1;cls.methods.set(key,slot);this.w32(cls.vtable+(slot+1)*4,this.member(name,member,sig));}
     this.w16(p[5+kind]+index*2,cls.methods.get(key));
    }
   }
  }
 }
 service(name,args){
  const [a,b,c,d]=args;
  if(name==='get_import_table')return a;
  if(name==='get_import_function')return this.stub('lgt|'+a+'|'+b);
  if(name.startsWith('class|'))return this.makeClass(name.slice(6)).object;
  if(name.startsWith('java|')){
   const [,className,method,sig]=name.split('|');
   const value=p=>this.objects.get(p)?.value??(p===0?'null':String(p|0));
   if(className==='java/lang/Object'&&method==='toString')return this.javaString(String(value(a)));
   if(className==='java/io/PrintStream'&&method==='println'){this.logs||=[];this.logs.push(String(value(b)));return 0;}
   if(className==='org/kwis/msp/io/FileSystem'){
    const name=String(value(a));if(method==='isFile'){if(!this.files.has(name)){try{const stored=this.storage?.getItem('nom3:file:'+name);if(stored)this.files.set(name,Uint8Array.from(JSON.parse(stored)));}catch{}}return +this.files.has(name);}if(method==='remove'){this.files.delete(name);try{this.storage?.removeItem('nom3:file:'+name);}catch{}return 0;}
   }
   if(className==='org/kwis/msp/io/File'){
    const obj=this.objects.get(a);if(method==='<init>'){const name=String(value(b));if(!this.files.has(name)){try{const stored=this.storage?.getItem('nom3:file:'+name);if(stored)this.files.set(name,Uint8Array.from(JSON.parse(stored)));}catch{}if(!this.files.has(name))this.files.set(name,new Uint8Array());}obj.file={name,pos:0};return 0;}
    const file=obj.file,data=this.files.get(file.name);if(method==='sizeOf')return data.length;if(method==='close'){try{this.storage?.setItem('nom3:file:'+file.name,JSON.stringify(Array.from(data)));}catch{}return 0;}
    if(method==='read'){const array=this.objects.get(b),chunk=data.subarray(file.pos,file.pos+d);this.write(array.data+c,chunk);file.pos+=chunk.length;return chunk.length||-1;}
    if(method==='write'){const array=this.objects.get(b),target=new Uint8Array(Math.max(data.length,file.pos+d));target.set(data);target.set(this.read(array.data+c,d),file.pos);this.files.set(file.name,target);file.pos+=d;return d;}
   }
   if(['java/io/ByteArrayOutputStream','java/io/DataOutputStream','java/io/OutputStream'].includes(className)){
    const obj=this.objects.get(a);
    if(method==='<init>'){if(className==='java/io/DataOutputStream')obj.source=b;else obj.buffer=[];return 0;}
    if(method==='toByteArray'){const p=this.array('[B',obj.buffer.length);this.write(this.objects.get(p).data,Uint8Array.from(obj.buffer));return p;}
    if(method==='close'||method==='flush')return 0;
    if(method==='writeUTF'){const text=String(value(b)),bytes=[];for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);if(c>0&&c<128)bytes.push(c);else if(c<2048)bytes.push(192|c>>6,128|c&63);else bytes.push(224|c>>12,128|c>>6&63,128|c&63);}this.writeBytes(a,[bytes.length>>8,bytes.length&255,...bytes]);return 0;}
    if(method==='write'){if(sig==='(I)V')this.writeBytes(a,[b&255]);else{const arr=this.objects.get(b);this.writeBytes(a,this.read(arr.data,arr.length));}return 0;}
    const size={writeBoolean:1,writeByte:1,writeShort:2,writeInt:4,writeLong:8}[method];
    if(size){const bytes=new Uint8Array(size);for(let i=0;i<Math.min(4,size);i++)bytes[size-1-i]=b>>>(i*8);if(size===8)for(let i=0;i<4;i++)bytes[3-i]=c>>>(i*8);this.writeBytes(a,bytes);return 0;}
   }
   if(className==='java/lang/Object'&&method==='equals')return +(a===b||(typeof this.objects.get(a)?.value==='string'&&value(a)===value(b)));
   if(className==='java/lang/StringBuffer'){
    const obj=this.objects.get(a);if(method==='<init>'){obj.value='';return 0;}
    if(method==='append'){obj.value+=(sig.startsWith('(C)')?String.fromCharCode(b):sig.startsWith('(I)')?String(b|0):value(b));return a;}
    if(method==='delete'){obj.value=obj.value.slice(0,b)+obj.value.slice(c);return a;}
   }
   if(className==='java/lang/String'){
    if(method==='valueOf')return this.javaString(sig.startsWith('(I)')?String(a|0):String(value(a)));
    if(method==='<init>'){const data=this.objects.get(b);this.objects.get(a).value=new TextDecoder('euc-kr').decode(this.read(data.data+c,d));return 0;}
    if(method==='charAt')return String(value(a)).charCodeAt(b);
    if(method==='substring')return this.javaString(String(value(a)).slice(b,sig==='(I)Ljava/lang/String;'?undefined:c));
    if(method==='startsWith')return +String(value(a)).startsWith(String(value(b)));
    if(method==='indexOf')return String(value(a)).indexOf(sig.startsWith('(I')?String.fromCharCode(b):String(value(b)),sig==='(II)I'||sig==='(Ljava/lang/String;I)I'?c:0);
    if(method==='trim')return this.javaString(String(value(a)).trim());
    if(method==='getBytes'){const bytes=new TextEncoder().encode(String(value(a))),p=this.array('[B',bytes.length);this.write(this.objects.get(p).data,bytes);return p;}
   }
   if(className==='org/kwis/msp/lcdui/Image'&&method==='createImage'){
    let image;if(sig.startsWith('([B')){const array=this.objects.get(a);image=decodePNG(this.read(array.data+b,c));}
    else if(sig.startsWith('(II)'))image={width:a,height:b,data:new Uint8ClampedArray(a*b*4).fill(255)};
    else image=decodePNG(this.resources.get(String(value(a)).replace(/^\//,'')));
    const object=this.instantiate(this.makeClass(className));this.objects.get(object).image=image;return object;
   }
   if(className==='org/kwis/msp/lcdui/Image'){
    const image=this.objects.get(a).image;if(method==='getWidth')return image.width;if(method==='getHeight')return image.height;if(method==='getGraphics')return this.graphics(image);
   }
   if(className==='org/kwis/msp/lcdui/Graphics'){
    const g=this.objects.get(a).graphics,extra=Array.from({length:3},(_,i)=>this.u32(this.r[13]+i*4)),x=b|0,y=c|0,w=d|0;
    if(method==='setColor'){g.color=b;return 0;}
    if(method==='translate'){g.tx+=x;g.ty+=y;return 0;}
    if(method==='getTranslateX')return g.tx;if(method==='getTranslateY')return g.ty;
    if(method==='setAlpha'){g.apiAlpha=b;return 0;}
    if(method==='setXORMode'){g.xor=!!b;return 0;}
    if(method==='fillRect'){g.fill(x,y,w,extra[0]|0);return 0;}
    if(method==='drawLine'){g.line(x,y,w,extra[0]|0);return 0;}
    if(method==='drawRect'){const h=extra[0]|0;g.line(x,y,x+w,y);g.line(x+w,y,x+w,y+h);g.line(x+w,y+h,x,y+h);g.line(x,y+h,x,y);return 0;}
    if(method==='setClip'){g.clip=[x+g.tx,y+g.ty,w,extra[0]|0];return 0;}
    if(method==='clipRect'){const left=Math.max(g.clip[0],x+g.tx),top=Math.max(g.clip[1],y+g.ty),right=Math.min(g.clip[0]+g.clip[2],x+g.tx+w),bottom=Math.min(g.clip[1]+g.clip[3],y+g.ty+(extra[0]|0));g.clip=[left,top,Math.max(0,right-left),Math.max(0,bottom-top)];return 0;}
    if(method==='getClipX')return g.clip[0]-g.tx;if(method==='getClipY')return g.clip[1]-g.ty;if(method==='getClipWidth')return g.clip[2];if(method==='getClipHeight')return g.clip[3];
    if(method==='drawImage'){g.draw(this.objects.get(b).image,c|0,d|0,extra[0]);return 0;}
   }
   if(method==='<init>'&&['org/kwis/msp/lcdui/Jlet','org/kwis/msp/lcdui/Card','java/lang/Object','java/io/InputStream','java/util/Random'].includes(className))return 0;
   if(className==='org/kwis/msp/lcdui/Display'&&method==='getDefaultDisplay')return this.display||(this.display=this.instantiate(this.makeClass(className)));
   if(className==='org/kwis/msp/lcdui/Display'&&method==='pushCard'){this.card=b;return 0;}
   if(className==='java/util/Calendar'){
    if(method==='getInstance'){const p=this.instantiate(this.makeClass(className));this.objects.get(p).date=new Date();return p;}
    const calendar=this.objects.get(a);
    if(method==='setTime'){calendar.date=new Date(this.objects.get(b).date.getTime());return 0;}
    if(method==='get'){
     const date=calendar.date,fields={1:date.getFullYear(),2:date.getMonth(),5:date.getDate(),7:date.getDay()+1,9:Math.floor(date.getHours()/12),10:date.getHours()%12,11:date.getHours(),12:date.getMinutes(),13:date.getSeconds(),14:date.getMilliseconds()};
     if(Object.hasOwn(fields,b))return fields[b];
     this.raiseJava('java/lang/IllegalArgumentException');
    }
   }
   if(className==='java/util/Date'){
    const date=this.objects.get(a);
    if(method==='<init>'){date.date=sig==='()V'?new Date():new Date((b>>>0)+(c|0)*4294967296);return 0;}
    if(method==='getTime'){const millis=date.date.getTime();this.r[1]=Math.floor(millis/4294967296);return millis;}
   }
   if(className==='org/kwis/msp/handset/BackLight')return 0;
   if(className==='org/kwis/msp/lcdui/Card'&&method==='getWidth')return this.seed.width;
   if(className==='org/kwis/msp/lcdui/Card'&&method==='getHeight')return this.seed.height;
   if(className==='org/kwis/msp/lcdui/Card'&&['repaint','serviceRepaints'].includes(method)){this.repaintRequested=true;return 0;}
   if(className==='org/kwis/msp/lwc/AnnunciatorComponent')return 0;
   if(className==='java/lang/Object'&&method==='notify')return 0;
   if(className==='java/lang/Object'&&method==='getClass')return this.objects.get(a)?.cls.object||0;
   if(className==='java/lang/Class'&&method==='getResourceAsStream'){
    const name=(this.objects.get(b)?.value||'').replace(/^\//,''),data=this.resources.get(name);if(!data)return 0;
    const p=this.instantiate(this.makeClass('java/io/ByteArrayInputStream'));Object.assign(this.objects.get(p),{data,pos:0});return p;
   }
   if(['java/io/InputStream','java/io/ByteArrayInputStream','java/io/DataInputStream'].includes(className)){
    const obj=this.objects.get(a);if(method==='<init>'){if(!b)this.raiseJava('java/lang/NullPointerException');if(className==='java/io/DataInputStream')obj.source=b;else obj.data=this.read(this.objects.get(b).data,this.objects.get(b).length);obj.pos=0;return 0;}
    const stream=obj.source?this.objects.get(obj.source):obj;if(method==='close')return 0;
    if(method.startsWith('read')&&method!=='read'){
     if(method==='readUTF'){const size=(this.readByte(a)<<8)|this.readByte(a),bytes=[];for(let i=0;i<size;i++)bytes.push(this.readByte(a));let text='';for(let i=0;i<bytes.length;){const x=bytes[i++];text+=String.fromCharCode(x<128?x:x<224?((x&31)<<6)|(bytes[i++]&63):((x&15)<<12)|((bytes[i++]&63)<<6)|(bytes[i++]&63));}return this.javaString(text);}
     const size={readBoolean:1,readByte:1,readUnsignedByte:1,readShort:2,readUnsignedShort:2,readChar:2,readInt:4}[method];
     if(size){let value=0;for(let i=0;i<size;i++){const byte=this.readByte(a);if(byte<0)throw Error('Unexpected EOF in '+method);value=(value<<8)|byte;}if(method==='readByte')return (value<<24)>>24;if(method==='readShort')return(value<<16)>>16;return value;}
    }
    if(method==='available')return stream.data.length-stream.pos;
    if(method==='skip'){const count=Math.min(b,stream.data.length-stream.pos);stream.pos+=count;this.r[1]=0;return count;}
    if(method==='read'){
     if(!stream.data){if(sig==='()I')throw Error('Abstract stream read');const array=this.objects.get(b),offset=sig==='([BII)I'?c:0,length=sig==='([BII)I'?d:array.length;let count=0;for(;count<length;count++){const value=this.readByte(a);if(value<0)break;this.w8(array.data+offset+count,value);}return count||-1;}
     if(sig==='()I')return stream.pos<stream.data.length?stream.data[stream.pos++]:-1;
     const array=this.objects.get(b),offset=sig==='([BII)I'?c:0,length=sig==='([BII)I'?d:array.length,count=Math.min(length,stream.data.length-stream.pos);if(!count)return -1;this.write(array.data+offset,stream.data.subarray(stream.pos,stream.pos+count));stream.pos+=count;return count;
    }
   }
   if(className==='org/kwis/msp/lwc/Component'&&method==='getHeight')return 20;
   if(className==='org/kwis/msp/handset/HandsetProperty'&&method==='getSystemProperty')return this.javaString(({PHONEMODEL:'Browser',BATTERYLEVEL:'100',RSSILEVEL:'30'})[this.objects.get(a)?.value]||'');
   if(className==='java/lang/String'&&method==='toCharArray'){const value=this.objects.get(a)?.value||'',p=this.array('[C',value.length),out=this.objects.get(p);for(let i=0;i<value.length;i++)this.w16(out.data+i*2,value.charCodeAt(i));return p;}
   if(className==='java/lang/String'&&method==='length')return this.objects.get(a)?.value?.length||0;
   if(['org/kwis/msp/media/BaseClip','org/kwis/msp/media/Clip','org/kwis/msp/media/Player','org/kwis/msp/media/Volume','org/kwis/msp/media/Vibrator'].includes(className))return method==='putData'?d:method==='setBuffer'||method==='play'||method==='stop'||method==='setVolume'?1:0;
   if(className==='java/util/Random'&&method==='nextInt'){let n=this.randomState||123456789;n^=n<<13;n^=n>>>17;n^=n<<5;return this.randomState=n>>>0;}
   if(className==='java/lang/Math')return method==='min'?Math.min(a|0,b|0):method==='max'?Math.max(a|0,b|0):Math.abs(a|0);
   if(className==='java/lang/System'){
    if(method==='gc')return 0;
    if(method==='currentTimeMillis'){this.r[1]=0;return this.time;}
    if(method==='arraycopy'){const src=this.objects.get(a),dst=this.objects.get(c),count=this.u32(this.r[13]);this.write(dst.data+d*dst.size,this.read(src.data+b*src.size,count*src.size));return 0;}
   }
   if(className==='java/lang/Runtime'){
    if(method==='getRuntime')return this.runtimeObject||(this.runtimeObject=this.instantiate(this.makeClass(className)));
    if(method==='totalMemory'){this.r[1]=0;return this.heap.length;}
    if(method==='freeMemory'){this.r[1]=0;return this.heap.length-(this.cursor-0x4000000)+this.freeBlocks.reduce((n,b)=>n+b.size,0);}
    if(method==='gc')return 0;
   }
   if(className==='java/lang/Thread'){
    if(method==='<init>'){this.objects.get(a).runnable=b;return 0;}
    if(method==='start'){this.threads||=[];this.threads.push({thread:a,runnable:this.objects.get(a).runnable,due:this.time});return 0;}
    if(method==='setPriority')return 0;
    if(method==='isAlive')return +!!this.threads?.some(t=>t.thread===a&&!t.done);
    if(method==='sleep'||method==='yield'){const error=Error('cooperative thread pause');error.yieldMs=method==='sleep'?Math.max(1,a):1;throw error;}
   }
  }
  if(name.startsWith('lgt|')){
   const [,tableText,indexText]=name.split('|'),table=Number(tableText),index=Number(indexText);
   if(index===3&&[0x64,0x1fc,0x1ff,0x201].includes(table))return 0;
   if(table===1&&index===0x418){this.write(a,new Uint8Array(c).fill(b&255));return a;}
   if(table===0x64&&index===7)return a;
   if(table===0x64&&index===0x14){this.link([...args,...Array.from({length:7},(_,i)=>this.u32(this.r[13]+i*4))]);return 0;}
   if(table===0x1f8&&index===0x17){const p=this.alloc(16);this.write(p,new TextEncoder().encode('nom3.jar\0'));this.w32(c,p);return 0;}
   if(table===0x64&&index===0x82){this.jarPath=this.str(a);return 0;}
   if(table===0x1f8&&index===0x16){if(b===100)this.seed.width=c;if(b===101)this.seed.height=c;return 0;}
   if(table===1&&index===0x32)return this.pendingException;
   if(table===1&&index===0x424){this.exitCallback=a;return 0;}
   if(table===0x64&&index===0x83){this.entryClass=this.str(a);this.applicationArgs=Array.from({length:c},(_,i)=>this.str(this.u32(d+i*4)));return 0;}
   if(table===0x64&&index===0x1f){this.exceptionFrames.push({regs:this.r.slice(),flags:[this.n,this.z,this.c,this.v,this.thumb]});this.pendingException=0;return;}
   if(table===0x64&&index===0x20){this.exceptionFrames.pop();this.pendingException=0;return;}
   if(table===0x64&&[0x54,0x55,0x56,0x57].includes(index))return 0;
   if(table===0x64&&index===0x22)this.raiseJava('java/lang/NullPointerException');
   if(table===0x64&&index===0x23)this.raiseJava('java/lang/ArrayIndexOutOfBoundsException');
   if(table===0x64&&index===0x25)this.raiseJava('java/lang/ArithmeticException');
   if(table===0x64&&index===0x21){const error=Error('Java exception');error.javaException=a;throw error;}
   if(table===0x64&&index===0x12){const target=this.str(b),cls=[...this.classes.values()].find(x=>x.raw===a)||this.objects.get(a)?.cls;for(let current=cls;current;current=current.parent)if(current.name===target)return 1;if(target==='java/lang/Object')return 1;if(target==='java/lang/Throwable'||target==='java/lang/Exception')return +(cls?.name.endsWith('Exception')||false);if(target==='java/lang/RuntimeException')return +['java/lang/NullPointerException','java/lang/ArrayIndexOutOfBoundsException','java/lang/IllegalArgumentException','java/lang/ArithmeticException'].includes(cls?.name);return 0;}
   if(table===0x64&&index===0x0b){const cls=this.generatedClass(a);const fn=this.u32(cls.desc+44);if(fn&&!cls.linked){cls.linked=true;this.invoke(fn,[cls.object]);}return 0;}
   if(table===0x64&&index===0x0c)return this.generatedClass(a).object;
   if(table===0x64&&index===0x0d){const cls=this.classObjects.get(a);if(b&&cls&&!cls.initialized){cls.initialized=true;this.w32(cls.fields+16,5);this.invoke(b,[]);}return 0;}
   if(table===0x64&&index===0x0f)return this.instantiate(this.classObjects.get(a));
   if(table===0x64&&index===9){const cached=this.u32(d);if(cached)return cached;const value=Array.from({length:c},(_,i)=>String.fromCharCode(this.u16(b+i*2))).join(''),object=this.javaString(value);this.w32(d,object);return object;}
   if(table===0x64&&index===0x0e){const component=b?this.str(b):({4:'Z',5:'C',6:'F',7:'D',8:'B',9:'S',10:'I',11:'J'})[c];return this.makeClass('['.repeat(a)+(component.length===1||component.startsWith('[')?component:'L'+component+';')).object;}
   if(table===0x64&&index===0x10)return this.array(this.classObjects.get(a).name,b);
   if(table===0x64&&index===0x11){const name=this.classObjects.get(a).name,dims=Array.from({length:c},(_,i)=>this.u32(b+i*4));const build=(type,depth)=>{const p=this.array(type,dims[depth]);if(depth+1<dims.length)for(let i=0;i<dims[depth];i++)this.w32(this.objects.get(p).data+i*4,build(type.slice(1),depth+1));return p;};return build(name,0);}
   if(table===0x64&&index===0xe1)return this.makeClass('java/lang/String').object;
   if(table===0x64&&index===0xe2)return this.makeClass('[Ljava/lang/String;').object;
   if(table===0x64&&[0x61,0xfa].includes(index)){this.w32(this.objects.get(a).data+b*4,c);return 0;}
  }
  throw Error('LGT service requires implementation: '+name+' args '+args.map(v=>v.toString(16)).join(','));
 }
 initialize(){const p1=this.alloc(536),p2=this.alloc(16);this.words(p2,this.stub('get_import_table'),this.stub('get_import_function'),0,0);this.call(this.seed.entry,[p1,p2,0]);const init=this.u32(p1+532);this.call(this.u32(init+4));}
 start(){const name=this.applicationArgs?.[0]||'Nom3',cls=this.makeClass(name);const instance=this.instantiate(cls),init=cls.generated.methods.find(m=>m.name==='<init>');if(init)this.call(Number(init.address),[instance]);const start=cls.generated.methods.find(m=>m.name==='startApp');this.call(Number(start.address),[instance,0]);}
 advance(time){this.time=time;for(const [i,thread] of (this.threads||[]).entries()){if(thread.done||thread.due>time)continue;this.exceptionFrames=thread.exceptionFrames||[];this.pendingException=thread.pendingException||0;try{if(thread.state)this.resume(thread.state);else this.call(this.u32(this.u32(thread.runnable)+44),[thread.runnable],0x70cf000-i*0x10000);thread.done=true;}catch(error){if(error.yieldMs===undefined)throw error;thread.state=error.state;thread.due=time+error.yieldMs;}finally{thread.exceptionFrames=this.exceptionFrames;thread.pendingException=this.pendingException;this.exceptionFrames=[];this.pendingException=0;}}
  if(this.card&&(this.repaintRequested||this.paintState)){
   if(!this.screenImage){this.screenImage={width:this.seed.width,height:this.seed.height,data:new Uint8ClampedArray(this.seed.width*this.seed.height*4)};for(let i=3;i<this.screenImage.data.length;i+=4)this.screenImage.data[i]=255;this.screenGraphics=this.graphics(this.screenImage);}
   this.exceptionFrames=this.paintFrames||[];this.pendingException=this.paintPending||0;try{if(this.paintState)this.resume(this.paintState);else{const g=this.objects.get(this.screenGraphics).graphics;g.tx=g.ty=0;g.clip=[0,0,this.seed.width,this.seed.height];this.call(this.u32(this.u32(this.card)+(27+1)*4),[this.card,this.screenGraphics],0x70ef000);}this.paintState=null;this.repaintRequested=false;this.frames++;this.presentRGBA?.(this.screenImage);}catch(error){if(error.yieldMs===undefined)throw error;this.paintState=error.state;}finally{this.paintFrames=this.exceptionFrames;this.paintPending=this.pendingException;this.exceptionFrames=[];this.pendingException=0;}
  }
 }
}
