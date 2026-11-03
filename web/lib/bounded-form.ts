export async function boundedBytes(request:Request,limit:number) {
  const reader=request.body?.getReader();if(!reader)throw new Error("empty upload");
  const chunks:Uint8Array[]=[];let size=0;
  try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new RangeError("request limit");}chunks.push(value);}}
  finally {reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return bytes;
}
export async function boundedForm(request:Request,limit:number) {
  const bytes=await boundedBytes(request,limit);
  return new Response(bytes,{headers:{"Content-Type":request.headers.get("content-type")||""}}).formData();
}
