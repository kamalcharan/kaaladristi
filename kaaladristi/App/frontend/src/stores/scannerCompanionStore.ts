import {create} from 'zustand'
export const useScannerCompanionStore=create<{open:boolean;pinned:boolean;show:()=>void;close:()=>void;pin:()=>void}>(set=>({open:false,pinned:false,show:()=>set({open:true}),close:()=>set({open:false}),pin:()=>set(s=>({pinned:!s.pinned}))}))
