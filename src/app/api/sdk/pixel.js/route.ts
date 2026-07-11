import { NextResponse } from 'next/server'

export const runtime = 'edge'

// Served as the loader script: <script src="https://brandgauge.app/api/sdk/pixel.js" data-pid="..."></script>
// Sets window.bp(event_type, value?, metadata?) that POSTs to /api/sdk/event.
const SCRIPT = `(function(w,d){
  var s=d.currentScript||d.querySelector('script[data-pid]');
  var pid=s&&s.getAttribute('data-pid');
  if(!pid){return;}
  w.bp=function(t,v,m){
    var p={pixel_id:pid,event_type:t,page_url:w.location.href,referrer:d.referrer};
    if(v!=null)p.value=v;
    if(m)p.metadata=m;
    fetch('/api/sdk/event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p),keepalive:true}).catch(function(){});
  };
  w.bp('page_view');
})(window,document);`

export function GET() {
  return new NextResponse(SCRIPT, {
    status: 200,
    headers: {
      'Content-Type':  'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
