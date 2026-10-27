import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';

// FRONTEND / MAP + GPS COORDINATES: แสดงพิกัดร้านและพิกัดลูกค้าบน Leaflet/OpenStreetMap
// เส้นถนนขอ geometry จาก OSRM public routing service; ไม่ใช่ GPS tracking สดของไรเดอร์
@Component({
  selector: 'app-route-map', standalone: true, imports: [CommonModule],
  template: `<div class="map-shell"><div #mapHost class="road-map"></div><div class="map-note" *ngIf="busy">กำลังคำนวณเส้นทางตามถนนจริง…</div><div class="map-error" *ngIf="error">{{error}}</div><div class="map-legend" *ngIf="routeLegend.length"><span *ngFor="let r of routeLegend"><i [style.background]="r.color"></i>ไรเดอร์ {{r.no}}</span></div></div>`,
  styles: [`.map-shell{position:relative;border:1px solid #e9eaf2;border-radius:13px;overflow:hidden;margin-bottom:18px}.road-map{height:440px;width:100%;background:#f4f1ea}.map-note,.map-error{position:absolute;z-index:500;left:12px;top:12px;background:#fff;padding:9px 12px;border-radius:8px;box-shadow:0 2px 12px #0002;font-size:12px}.map-error{top:auto;bottom:12px;color:#b34a55;max-width:85%}.map-legend{position:absolute;z-index:500;left:12px;bottom:12px;background:#fff;padding:9px 12px;border-radius:8px;box-shadow:0 2px 12px #0002;display:flex;flex-wrap:wrap;gap:10px;font-size:11px}.map-legend span{display:flex;align-items:center;gap:5px}.map-legend i{width:10px;height:10px;border-radius:50%;display:inline-block}@media(max-width:650px){.road-map{height:350px}}`]
})
export class RouteMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() plan: any;
  @ViewChild('mapHost') mapHost!: ElementRef<HTMLDivElement>;
  private map?: L.Map;
  private layers: L.Layer[] = [];
  private ready = false;
  private requestId = 0;
  busy = false;
  error = '';
  routeLegend: {no: string|number; color: string}[] = [];

  ngAfterViewInit(): void {
    this.map = L.map(this.mapHost.nativeElement, { zoomControl: true }).setView([16.245, 103.25], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(this.map);
    this.ready = true;
    void this.drawPlan();
    setTimeout(() => this.map?.invalidateSize(), 0);
  }
  ngOnChanges(changes: SimpleChanges): void { if (changes['plan'] && this.ready) void this.drawPlan(); }
  ngOnDestroy(): void { this.requestId++; this.map?.remove(); }

  // อ่าน latitude/longitude จากข้อมูล Backend; GPS และแผนที่ต้องมีพิกัดที่ถูกต้อง
  private coordinate(value: any): [number, number] | null {
    const lat = Number(value?.lat ?? value?.latitude);
    const lng = Number(value?.lng ?? value?.lon ?? value?.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [lat, lng] : null;
  }

  private async drawPlan(): Promise<void> {
    if (!this.map) return;
    const request = ++this.requestId;
    this.layers.forEach(layer => layer.remove()); this.layers = [];
    this.error = ''; this.routeLegend = [];
    const plan = this.plan;
    if (!plan) return;
    const bounds: L.LatLngExpression[] = [];
    const depot = this.coordinate(plan.depot);
    if (depot) {
      const marker = L.marker(depot).bindTooltip('ร้าน / จุดเริ่มต้น');
      marker.addTo(this.map); this.layers.push(marker); bounds.push(depot);
    }
    const routes = Array.isArray(plan.routes) ? plan.routes : [];
    this.busy = true;
    try {
      for (const route of routes) {
        if (request !== this.requestId) return;
        const stops = Array.isArray(route.stops) ? [...route.stops].sort((a,b) => Number(a.seq)-Number(b.seq)) : [];
        const stopPoints = stops.map((s: any) => ({ stop: s, point: this.coordinate(s) })).filter((x: any) => x.point !== null) as {stop:any;point:[number,number]}[];
        const points: [number,number][] = [];
        if (depot) points.push(depot);
        stopPoints.forEach(x => points.push(x.point));
        const color = route.colorHex || '#6b5ce7';
        this.routeLegend.push({ no: route.routeNo ?? route.routeId ?? '?', color });
        stopPoints.forEach(({stop, point}) => {
          const marker = L.circleMarker(point, { radius: 7, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 })
            .bindTooltip(`${String(stop.seq ?? '')}. ${String(stop.customerName ?? 'ลูกค้า')} · ${String(stop.boxCount ?? 0)} กล่อง`);
          marker.addTo(this.map!); this.layers.push(marker); bounds.push(point);
        });
        if (points.length < 2) continue;
        // Request each leg separately so one unsupported waypoint does not hide the whole route.
        // Every leg starts at the shop/depot for the first stop, then follows stop order.
        let routeFailed = false;
        for (let i = 0; i < points.length - 1; i++) {
          if (request !== this.requestId) return;
          const a = points[i], b = points[i + 1];
          const coordString = `${a[1]},${a[0]};${b[1]},${b[0]}`;
          const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson&steps=false`;
          try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`OSRM HTTP ${response.status}`);
            const result = await response.json();
            if (request !== this.requestId) return;
            const coordinates = result?.routes?.[0]?.geometry?.coordinates;
            if (!Array.isArray(coordinates) || coordinates.length < 2) throw new Error('ไม่พบ geometry');
            const latlngs = coordinates.map((c: number[]) => [c[1], c[0]] as L.LatLngExpression);
            const line = L.polyline(latlngs, { color, weight: 5, opacity: .9, lineJoin: 'round' });
            line.addTo(this.map!); this.layers.push(line);
            coordinates.forEach((c: number[]) => bounds.push([c[1], c[0]]));
          } catch {
            routeFailed = true;
          }
        }
        if (routeFailed) this.error = 'บางช่วงดึงเส้นทางถนนจริงไม่สำเร็จ อาจเป็นเพราะพิกัดไม่อยู่บนถนนหรือบริการ OSRM ขัดข้อง';
      }
      if (bounds.length) this.map.fitBounds(L.latLngBounds(bounds), { padding: [35,35], maxZoom: 15 });
    } catch {
      if (request === this.requestId) this.error = 'ดึงเส้นทางถนนจริงไม่สำเร็จ โปรดตรวจอินเทอร์เน็ตหรือบริการ OSRM แล้วเปิดรายละเอียดแผนใหม่';
    } finally { if (request === this.requestId) this.busy = false; }
  }
}
