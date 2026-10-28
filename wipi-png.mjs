import {unzlibSync} from './fflate.mjs';
export function decodePNG(bytes){
 const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);if(d.getUint32(0)!==0x89504e47)throw Error('Unsupported image signature');
 let w,h,depth,type,palette,alpha,chunks=[];
 for(let pos=8;pos+12<=bytes.length;){const n=d.getUint32(pos),tag=String.fromCharCode(...bytes.subarray(pos+4,pos+8));if(pos+12+n>bytes.length)throw Error('Truncated PNG');const data=bytes.subarray(pos+8,pos+8+n);if(tag==='IHDR'){w=d.getUint32(pos+8);h=d.getUint32(pos+12);depth=data[8];type=data[9];if(data[12]!==0)throw Error('Interlaced PNG not supported');}if(tag==='PLTE')palette=data;if(tag==='tRNS')alpha=data;if(tag==='IDAT')chunks.push(data);pos+=n+12;}
 const channels={0:1,2:3,3:1,4:2,6:4}[type];if(!channels||![1,2,4,8].includes(depth)||w>8192||h>8192||w*h>16*1024*1024)throw Error(`Unsupported PNG format: ${w}x${h}, depth ${depth}, type ${type}`);
 const all=new Uint8Array(chunks.reduce((n,c)=>n+c.length,0));let p=0;for(const c of chunks){all.set(c,p);p+=c.length;}
 const inflated=unzlibSync(all),stride=Math.ceil(w*channels*depth/8),bpp=Math.max(1,Math.ceil(channels*depth/8)),raw=new Uint8Array(stride*h);
 const paeth=(a,b,c)=>{const p=a+b-c,x=Math.abs(p-a),y=Math.abs(p-b),z=Math.abs(p-c);return x<=y&&x<=z?a:y<=z?b:c;};
 for(let y=0;y<h;y++){const filter=inflated[y*(stride+1)];for(let x=0;x<stride;x++){const left=x>=bpp?raw[y*stride+x-bpp]:0,up=y?raw[(y-1)*stride+x]:0,corner=y&&x>=bpp?raw[(y-1)*stride+x-bpp]:0;let value=inflated[y*(stride+1)+1+x];if(filter===1)value+=left;else if(filter===2)value+=up;else if(filter===3)value+=(left+up)>>1;else if(filter===4)value+=paeth(left,up,corner);else if(filter>4)throw Error('Unsupported PNG filter');raw[y*stride+x]=value;}}
 const rgba=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const j=(y*w+x)*4,index=y*stride+Math.floor(x*channels*depth/8);if(type===3||type===0){const shift=8-depth-(x*depth%8),sample=(raw[index]>>>shift)&((1<<depth)-1);if(type===3){rgba[j]=palette[sample*3];rgba[j+1]=palette[sample*3+1];rgba[j+2]=palette[sample*3+2];rgba[j+3]=alpha?.[sample]??255;}else {rgba[j]=rgba[j+1]=rgba[j+2]=sample*255/((1<<depth)-1);rgba[j+3]=255;}}else{rgba[j]=raw[index];rgba[j+1]=type===4?raw[index]:raw[index+1];rgba[j+2]=type===4?raw[index]:raw[index+2];rgba[j+3]=type===6?raw[index+3]:type===4?raw[index+1]:255;}}
 return {width:w,height:h,data:rgba};
}
