import { Boxes } from 'lucide-react'

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="logo-wrap">
      <span className="logo-mark"><Boxes size={20} strokeWidth={2.4} /></span>
      {!compact && <span className="logo-text">LoadWise <b>AI</b></span>}
    </div>
  )
}
