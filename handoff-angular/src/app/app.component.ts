import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from './api.service';
import { RouteMapComponent } from './route-map.component';

// FRONTEND / Navigation: เพิ่ม 'rider' ใน union type เพื่อให้ template ใช้ page==='rider' ได้โดยไม่เกิด TS2367
// FIX TS2367: page intentionally uses string so template page checks don't conflict with stale/narrow unions.
type Page = string;
@Component({
  selector: 'app-root', standalone: true, imports: [CommonModule, FormsModule, RouteMapComponent],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  // FRONTEND / API: ApiService เป็นตัวกลางเรียก REST API ของ Backend ที่มีอยู่แล้ว
  private api = inject(ApiService);
  page: Page = 'dashboard';
  today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  // FRONTEND / UI state: loading, error, notice ใช้แสดงสถานะการโหลดและข้อความแจ้งเตือน
  loading = false; error = ''; notice = '';
  // GPS: พิกัดจาก GPS ของอุปกรณ์ (ต้องให้สิทธิ์ Location ผ่าน browser ก่อน)
  gpsLoading = false; gpsError = ''; currentGps: { lat: number; lng: number; accuracy: number } | null = null;
  summary: any = {}; orders: any[] = []; customers: any[] = []; plans: any[] = []; selectedPlan: any = null;
  settings: any = {shopName:'ร้านข้าวกล่อง', depotLat:16.245, depotLng:103.25, boxPrice:65, boxCost:40, riderBaseFee:15, riderRatePerKmBox:2, riderSpeedKmh:30, serviceTimeMin:3, maxOrdersRider:3, departTime:'11:30', deadlineTime:'12:30', serviceRadiusKm:3, roadFactor:1.3};
  orderQuery = ''; customerQuery = ''; jobCode = ''; riderJob: any = null; simCount = 25; simMode = 'replace';
  customerForm: any = {firstName:'',lastName:'',phone:'',latitude:16.245,longitude:103.25}; editingCustomer: any = null;
  nav: {id:Page,label:string,icon:string}[] = [
    {id:'dashboard',label:'ภาพรวม',icon:'▦'}, {id:'orders',label:'รายการออเดอร์',icon:'▤'},
    {id:'customers',label:'ลูกค้า',icon:'♙'}, {id:'routes',label:'จัดเส้นทางส่ง',icon:'⌖'},
    {id:'rider',label:'ใบงานไรเดอร์',icon:'➤'}, {id:'settings',label:'ตั้งค่าร้าน',icon:'⚙'}
  ];
  get pageTitle(): string { return this.nav.find(n => n.id === this.page)?.label ?? 'ภาพรวม'; }
  // เริ่มต้นหน้าเว็บด้วยการโหลดข้อมูลภาพรวม ออเดอร์ และการตั้งค่าจาก Backend
  ngOnInit() { this.refreshAll(); }
  setPage(p: Page) { this.page=p; this.error=''; this.notice=''; if(p==='rider') { this.riderJob=null; this.jobCode=''; } if(p==='orders') this.loadOrders(); if(p==='customers') this.loadCustomers(); if(p==='routes') this.loadPlans(); if(p==='settings') this.loadSettings(); }
  message(e:any) { return e?.error?.error?.message || e?.error?.message || 'เชื่อมต่อ Backend ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'; }
  run(obs: any, done: (v: any) => void): void { this.loading=true; this.error=''; obs.subscribe({next:(v: any)=>{this.loading=false;done(v);},error:(e: any)=>{this.loading=false;this.error=this.message(e);}}); }
  // FRONTEND -> BACKEND: โหลดข้อมูลหลักผ่าน endpoint ตาม API.md โดยไม่สร้าง endpoint ใหม่
  refreshAll() {
    this.run(this.api.get<any>('/dashboard/summary',{date:this.today}), v=>this.summary=v.data??v);
    this.loadOrders(); this.loadSettings();
  }
  // ORDERS: ดึงรายการออเดอร์จาก GET /orders
  loadOrders() { this.run(this.api.get<any>('/orders',{date:this.today,q:this.orderQuery,limit:100}),v=>this.orders=v.data??[]); }
  simulateOrders() {
    this.run(this.api.post<any>('/orders/simulate',{count:Math.max(20,Math.min(30,Number(this.simCount)||25)),mode:this.simMode,deliveryDate:this.today}),v=>{this.notice=`จำลองออเดอร์สำเร็จ ${v.data?.length ?? v.summary?.createdCount ?? ''} รายการ`;this.loadOrders();this.refreshSummary();});
  }
  clearSimulated() {
    if(!confirm('ยืนยันลบเฉพาะออเดอร์จำลองของวันนี้ทั้งหมด?')) return;
    this.run(this.api.delete<any>(`/orders/simulated?date=${this.today}`),v=>{this.notice='ล้างออเดอร์จำลองเรียบร้อย';this.loadOrders();this.refreshSummary();});
  }
  updateBoxes(o:any, value:any) { const id=o.order_id ?? o.id; this.run(this.api.patch(`/orders/${id}`,{boxCount:Number(value)}),()=>{this.notice='บันทึกจำนวนกล่องแล้ว';this.loadOrders();this.refreshSummary();}); }
  deleteOrder(o:any) { if(!confirm('ยืนยันลบออเดอร์นี้?'))return; this.run(this.api.delete(`/orders/${o.order_id??o.id}`),()=>{this.notice='ลบออเดอร์แล้ว';this.loadOrders();this.refreshSummary();}); }
  // CUSTOMERS: ดึงรายชื่อลูกค้าจาก GET /customers
  loadCustomers() { this.run(this.api.get<any>('/customers',{q:this.customerQuery,limit:100,sort:'name'}),v=>this.customers=v.data??[]); }
  saveCustomer() {
    const body={firstName:this.customerForm.firstName,lastName:this.customerForm.lastName,phone:this.customerForm.phone,latitude:Number(this.customerForm.latitude),longitude:Number(this.customerForm.longitude)};
    const req=this.editingCustomer?this.api.put(`/customers/${this.editingCustomer.customerId??this.editingCustomer.id}`,body):this.api.post('/customers',body);
    this.run(req,()=>{this.notice='บันทึกข้อมูลลูกค้าแล้ว';this.resetCustomer();this.loadCustomers();});
  }
  editCustomer(c:any) { this.editingCustomer=c; this.customerForm={firstName:c.firstName??c.first_name,lastName:c.lastName??c.last_name,phone:c.phone??c.phone_number,latitude:c.latitude,longitude:c.longitude}; }
  resetCustomer() { this.editingCustomer=null;this.customerForm={firstName:'',lastName:'',phone:'',latitude:this.settings.depotLat,longitude:this.settings.depotLng}; }
  deleteCustomer(c:any) { if(!confirm('ยืนยันลบลูกค้ารายนี้?'))return;this.run(this.api.delete(`/customers/${c.customerId??c.id}`),()=>{this.notice='ลบลูกค้าแล้ว';this.loadCustomers();}); }
  // DISPATCH: โหลดแผนจาก GET /dispatch-plans; ซ่อนแผนที่ถูกยกเลิกจากหน้าจอ
  loadPlans() { this.run(this.api.get<any>('/dispatch-plans',{date:this.today}),v=>{ this.plans=(v.data??[]).filter((p:any)=>String(p.status??'').toUpperCase()!=='CANCELLED'); if(this.selectedPlan && !this.plans.some((p:any)=>String(p.planId??p.id)===String(this.selectedPlan.planId??this.selectedPlan.id))) this.selectedPlan=null; }); }
  calculate(recalculate=false) { this.run(this.api.post<any>('/dispatch-plans',{deliveryDate:this.today,...(recalculate?{recalculate:true}:{})}),v=>{this.plans=v.data??[];this.notice='คำนวณแผนจัดส่งเรียบร้อย';this.loadPlans();}); }
  showPlan(p:any) { const id=p.planId??p.id; this.run(this.api.get<any>(`/dispatch-plans/${id}`),v=>{this.selectedPlan=v.data??v;}); }
  confirmPlan(p:any) { if(!confirm('ยืนยันแผนนี้และออกเลขใบงานให้ไรเดอร์?'))return; const id=p.planId??p.id; this.run(this.api.post<any>(`/dispatch-plans/${id}/confirm`),()=>{this.notice='ยืนยันแผนและออกเลขใบงานแล้ว'; this.loadPlans(); this.refreshSummary(); this.run(this.api.get<any>(`/dispatch-plans/${id}`),v=>{this.selectedPlan=v.data??v;});}); }
  cancelPlan(p:any) { if(!confirm('ยืนยันยกเลิกแผนนี้? ใบงานไรเดอร์ของแผนนี้จะใช้ไม่ได้ และระบบจะไม่สร้างแผนใหม่ให้อัตโนมัติ'))return; const id=p.planId??p.id; this.run(this.api.post<any>(`/dispatch-plans/${id}/cancel`),()=>{ this.notice='ยกเลิกแผนแล้ว ใบงานของแผนนี้ถูกยกเลิกตาม Backend'; if(String(this.selectedPlan?.planId??this.selectedPlan?.id)===String(id)) this.selectedPlan=null; this.plans=this.plans.filter((x:any)=>String(x.planId??x.id)!==String(id) && String(x.status??'').toUpperCase()!=='CANCELLED'); this.refreshSummary(); this.loadPlans(); }); }
  loadSettings() { this.run(this.api.get<any>('/settings'),v=>this.settings={...this.settings,...(v.data??v)}); }
  saveSettings() { this.run(this.api.put('/settings',this.settings),()=>this.notice='บันทึกการตั้งค่าร้านแล้ว'); }
  refreshSummary() { this.run(this.api.get<any>('/dashboard/summary',{date:this.today}),v=>this.summary=v.data??v); }
  // RIDER JOB: ใช้เลขใบงานที่ร้านออกให้ ค้นจาก endpoint จริง GET /public/jobs/:jobCode
  findJob() { this.riderJob=null; this.gpsError=''; this.run(this.api.get<any>(`/public/jobs/${encodeURIComponent(this.jobCode.trim())}`),v=>this.riderJob=v.data??v); }

  // GPS: ขอพิกัดปัจจุบันจากอุปกรณ์ด้วย Geolocation API ของ browser ไม่ได้ส่งพิกัดไป Backend
  // Browser ต้องอนุญาต Location และโดยทั่วไปต้องเปิดเว็บผ่าน HTTPS หรือ localhost
  getCurrentGps() {
    this.gpsError = '';
    if (!('geolocation' in navigator)) { this.gpsError = 'อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับ GPS'; return; }
    this.gpsLoading = true;
    navigator.geolocation.getCurrentPosition(
      position => { this.currentGps = { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy }; this.gpsLoading = false; },
      error => { this.gpsLoading = false; this.gpsError = error.code === 1 ? 'กรุณาอนุญาตตำแหน่ง (Location) ในเบราว์เซอร์ก่อน' : 'อ่านตำแหน่งไม่สำเร็จ กรุณาเปิด GPS แล้วลองอีกครั้ง'; },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  }

  // GPS -> Google Maps: ถ้ามีพิกัด GPS จะใช้เป็นจุดเริ่มต้น ถ้าไม่มีจะใช้พิกัดร้านจากใบงาน
  mapsToStop(job: any, stop: any) {
    const origin = this.currentGps ? `${this.currentGps.lat},${this.currentGps.lng}` : `${job?.depot?.lat},${job?.depot?.lng}`;
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(`${stop.lat},${stop.lng}`)}&travelmode=driving`;
  }
  // Google Maps multi-stop: ใช้พิกัดร้านเป็นต้นทาง และเรียงจุดส่งตามลำดับในใบงาน
  mapsUrl(job:any) { const pts=job?.stops??[]; if(!pts.length)return 'https://maps.google.com';const origin=`${job.depot.lat},${job.depot.lng}`;const dest=pts[pts.length-1];const waypoints=pts.slice(0,-1).map((p:any)=>`${p.lat},${p.lng}`).join('|');return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(`${dest.lat},${dest.lng}`)}${waypoints?'&waypoints='+encodeURIComponent(waypoints):''}&travelmode=driving`; }
  copyJobCode(code:string) { if(!code)return; if(navigator.clipboard?.writeText) navigator.clipboard.writeText(code).then(()=>this.notice=`คัดลอกเลขใบงาน ${code} แล้ว`).catch(()=>this.notice=`เลขใบงาน: ${code}`); else this.notice=`เลขใบงาน: ${code}`; }
  money(v:any) { return Number(v||0).toLocaleString('th-TH',{style:'currency',currency:'THB',maximumFractionDigits:2}); }
  getName(o:any) { return [o.first_name??o.firstName,o.last_name??o.lastName].filter(Boolean).join(' ') || o.customerName || '-'; }
  getOrderId(o:any) { return o.order_no??o.orderNo??`#${o.order_id??o.id}`; }
}