/** Track UI save state separately from storage; ordered writes still live in save.js. */
export class SaveStatus {
  constructor(onChange=()=>{}) {
    this.onChange=onChange;
    this.session=0;this.revision=0;this.persisted=0;this.pending=0;this.lastSnapshotRevision=0;this.lastSaved=null;this.failure=null;
  }
  reset() {
    this.session++;this.revision=0;this.persisted=0;this.pending=0;this.lastSnapshotRevision=0;this.lastSaved=null;this.failure=null;
    this.publish();
  }
  dirty() {this.revision++;this.publish();}
  // Movement and gradual healing can change state every frame. Mark the first
  // such change after each snapshot, without scheduling/encrypting per frame.
  continuousChange() {
    if (this.revision<=this.lastSnapshotRevision) this.dirty();
  }
  begin() {
    this.lastSnapshotRevision=this.revision;
    const token={session:this.session,revision:this.revision};
    this.pending++;this.publish();return token;
  }
  finish(token,error=null,now=Date.now()) {
    if (token.session!==this.session) return;
    this.pending=Math.max(0,this.pending-1);
    if (error) this.failure={revision:token.revision,message:String(error.message || error)};
    else {
      this.persisted=Math.max(this.persisted,token.revision);this.lastSaved=now;
      if (this.failure && token.revision>=this.failure.revision) this.failure=null;
    }
    this.publish();
  }
  snapshot() {
    let status='idle';
    if (this.failure && this.failure.revision>=this.persisted) status='error';
    else if (this.pending) status='saving';
    else if (this.revision>this.persisted) status='pending';
    else if (this.lastSaved!==null) status='saved';
    return {status,lastSaved:this.lastSaved,error:this.failure?.message || ''};
  }
  publish() {this.onChange(this.snapshot());}
}
