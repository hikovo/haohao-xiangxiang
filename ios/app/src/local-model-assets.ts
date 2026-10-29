import {invoke} from '@tauri-apps/api/core';
export type ModelAssetState={status:string;progress:number;receivedBytes:number;totalBytes:number;installed:boolean;source?:string};
export const modelAssetsNative=()=> '__TAURI_INTERNALS__' in window;
export async function modelAssetOperation(operation:'assetStatus'|'download'|'cancelDownload'='assetStatus'):Promise<ModelAssetState> {
  if(!modelAssetsNative())return {status:import.meta.env.DEV&&import.meta.env.VITE_LOCAL_MODEL_PREVIEW==='1'?'ready':'browser',progress:0,receivedBytes:0,totalBytes:0,installed:false};
  const result=await invoke<{snapshot?:string}>('plugin:mobile-pet|local_model',{payload:JSON.stringify({operation})});
  return JSON.parse(result.snapshot||'{"status":"failed"}') as ModelAssetState;
}
