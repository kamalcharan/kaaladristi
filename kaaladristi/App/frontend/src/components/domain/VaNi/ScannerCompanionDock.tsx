import {DISCOVERY_SCANNER_IDS,MARKET_SCANNER_IDS,FLOW_SCANNER_IDS,STAGE_SCANNER_IDS,SCANNER_INTRODUCTIONS} from '@/constants/scannerIntroductions'
import ScannerCompanionShell from './ScannerCompanionShell'
/** Route-owned defaults render directly in the dock, independently of result-page branches. */
export default function ScannerCompanionDock({presetId}:{presetId:string}) {
 const isFlow=(FLOW_SCANNER_IDS as readonly string[]).includes(presetId)
 const isStage=(STAGE_SCANNER_IDS as readonly string[]).includes(presetId)
 const isDiscovery=(DISCOVERY_SCANNER_IDS as readonly string[]).includes(presetId)
 const isMarket=(MARKET_SCANNER_IDS as readonly string[]).includes(presetId)
 return <div id="scanner-vani-host" className="scanner-vani-host">
  {(isFlow||isStage||isDiscovery||isMarket)&&<ScannerCompanionShell key={presetId} portal={false} presetId={presetId} subtitle={`${SCANNER_INTRODUCTIONS[presetId].name} · ${isFlow?'Flow':isStage?'Stage':isDiscovery?'Discovery':'Market'} research`}>{null}</ScannerCompanionShell>}
 </div>
}
