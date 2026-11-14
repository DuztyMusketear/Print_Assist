import {test,expect} from 'vitest';
import {readProfile} from './profile';
const profile={title:'Tray',modelReference:'tray.stl',duration_seconds:600,filament_grams:20,filament_type:'PLA',color:'blue'};
test('prepared profiles carry estimates and compatibility without user guesses',()=>{
 expect(readProfile(JSON.stringify(profile))).toMatchObject({...profile,required_capabilities:['FFF'],visual_asset_id:null});
 for(const value of [null,{}, {...profile,duration_seconds:0},{...profile,filament_grams:0},{...profile,color:''},{...profile,required_capabilities:[]},{...profile,required_capabilities:[1]},{...profile,required_capabilities:'FFF'},{...profile,visual_asset_id:3}]) expect(()=>readProfile(JSON.stringify(value))).toThrow();
 expect(readProfile(JSON.stringify({...profile,required_capabilities:['FFF'],visual_asset_id:'example-tower'})).visual_asset_id).toBe('example-tower');
});
