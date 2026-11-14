import type {components} from '../types';
export type ModelProfile=components['schemas']['ModelTaskCreate'];
export function readProfile(text:string):ModelProfile {
 const value=JSON.parse(text);
 if(!value||typeof value!=='object') throw new Error('Choose a prepared model profile JSON file.');
 const strings=['title','modelReference','filament_type','color'];
 if(strings.some(key=>typeof value[key]!=='string'||!value[key].trim())||!Number.isInteger(value.duration_seconds)||value.duration_seconds<=0||!Number.isFinite(value.filament_grams)||value.filament_grams<=0) throw new Error('Profile needs a name, file reference, material, color, positive print time and filament weight. Ask the model preparer for a complete profile.');
 const capabilities=value.required_capabilities ?? ['FFF'];
 if(!Array.isArray(capabilities)||capabilities.length===0||capabilities.some(item=>typeof item!=='string'||!item.trim())) throw new Error('Profile printer settings are invalid. Ask the model preparer to check compatibility.');
 if(value.visual_asset_id!=null&&typeof value.visual_asset_id!=='string') throw new Error('Profile preview reference is invalid.');
 return {title:value.title.trim(),modelReference:value.modelReference.trim(),duration_seconds:value.duration_seconds,filament_grams:value.filament_grams,filament_type:value.filament_type.trim(),color:value.color.trim(),required_capabilities:capabilities,visual_asset_id:value.visual_asset_id ?? null};
}
