// FRONTEND / API CLIENT
// จุดรวมการเรียก Backend ทั้งหมด: เปลี่ยน baseUrl เฉพาะเมื่อมี URL backend จริงที่ผู้ดูแลให้มา
// เมธอด get/post/put/patch/delete ใช้ HTTP method ตามที่ระบุใน backend/API.md
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  // URL Backend เดิมของโปรเจค ห้ามสร้าง endpoint เองหรือเปลี่ยนสัญญา API โดยไม่ตรวจ API.md
  readonly baseUrl = 'https://delivery-backend-7bhh.onrender.com';
  get<T = any>(path: string, query?: Record<string, string | number | undefined>): Observable<T> {
    let params = new HttpParams();
    Object.entries(query ?? {}).forEach(([k,v]) => { if (v !== undefined && v !== '') params = params.set(k, String(v)); });
    return this.http.get<T>(this.baseUrl + path, { params });
  }
  post<T = any>(path: string, body: unknown = {}): Observable<T> { return this.http.post<T>(this.baseUrl + path, body); }
  put<T = any>(path: string, body: unknown): Observable<T> { return this.http.put<T>(this.baseUrl + path, body); }
  patch<T = any>(path: string, body: unknown): Observable<T> { return this.http.patch<T>(this.baseUrl + path, body); }
  delete<T = any>(path: string): Observable<T> { return this.http.delete<T>(this.baseUrl + path); }
}