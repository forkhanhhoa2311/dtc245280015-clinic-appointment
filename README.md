DTC245280015
Nguyen Thi Khanh Hoa
# Đề 40 — Hệ thống đặt lịch hẹn phòng khám

Website đặt lịch khám theo dịch vụ, bác sĩ và khung giờ.
Triển khai bằng Docker Compose, sử dụng PostgreSQL, pgAdmin,
Nginx, Prometheus, Grafana, Loki và Promtail.

## 1. Chức năng

- Xem và chọn dịch vụ khám.
- Chọn bác sĩ, ngày khám và khung giờ còn trống.
- Nhập thông tin khách hàng.
- Gửi yêu cầu đặt lịch và hiển thị thông tin xác nhận.
- Lưu lịch hẹn trong PostgreSQL.
- Chặn đặt lịch vào thời gian đã qua tại backend.
- Ngăn đặt trùng khung giờ bằng transaction, khóa hàng
  và ràng buộc UNIQUE trong database.

Lịch mới có trạng thái `pending` — chờ phòng khám xác nhận.
Thông báo “Đặt lịch thành công” nghĩa là hệ thống đã tiếp nhận
yêu cầu, không có nghĩa phòng khám đã duyệt lịch.

## 2. Kiến trúc

- Trình duyệt truy cập Nginx.
- Nginx phục vụ frontend và chuyển `/api/` tới backend.
- Backend Node.js/Express đọc và ghi PostgreSQL.
- pgAdmin dùng để quản lý và kiểm tra dữ liệu.
- Prometheus thu thập metrics từ các exporter.
- Grafana hiển thị dashboard giám sát.
- Promtail thu thập log Docker và gửi tới Loki.
- Grafana Explore truy vấn log bằng LogQL.

Các exporter:

| Thành phần | Mục đích |
|---|---|
| cAdvisor | Metrics tài nguyên container |
| Node Exporter | Metrics hệ thống trong môi trường đã cấu hình |
| PostgreSQL Exporter | Metrics PostgreSQL |
| Blackbox Exporter | Kiểm tra HTTP của website |

## 3. Yêu cầu môi trường

- Máy Linux có Docker Engine và Docker Compose plugin.
- Git.
- Các cổng triển khai không bị ứng dụng khác chiếm.

Kiểm tra:

```bash
docker --version
docker compose version
```

## 4. Chuẩn bị cấu hình

```bash
git clone https://github.com/forkhanhhoa2311/dtc245280015-clinic-appointment.git
cd dtc245280015-clinic-appointment
cp .env.example .env
```

Chỉnh `.env`:

```dotenv
POSTGRES_DB=clinic_db
POSTGRES_USER=clinic_user
POSTGRES_PASSWORD=<mat_khau_DB_manh>

PGADMIN_DEFAULT_EMAIL=<email_quan_tri>
PGADMIN_DEFAULT_PASSWORD=<mat_khau_pgAdmin_manh>

PGADMIN_PORT=5050
POSTGRES_PORT=5433
```

Thay các giá trị trong dấu `<...>` bằng thông tin thực tế.
Không dùng `change_me` khi triển khai.

Compose hiện bind các dịch vụ giao diện vào IP
`192.168.244.130`. Nếu triển khai trên máy khác, thay IP này
trong các dòng `ports` bằng IP của máy triển khai.

Backend và PostgreSQL bind cổng host trên `127.0.0.1`.

Không commit `.env` lên GitHub.

## 5. Khởi động

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps -a
```

PostgreSQL chạy `init.sql` khi khởi tạo volume dữ liệu mới.
File này tạo bảng và index.

Dữ liệu mẫu trong `database/seed.sql` chưa được Compose
tự động nạp. Với database mới, sau khi PostgreSQL sẵn sàng:

```bash
docker exec -i clinic_postgres sh -c \
  'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < database/seed.sql
```

Seed cung cấp dữ liệu demo và một số khung giờ theo ngày
tương đối tại thời điểm chạy. Không bảo đảm mọi bác sĩ có lịch
cho mọi ngày.

Không cần nạp lại seed chỉ để khởi động hệ thống đã có dữ liệu.

## 6. Địa chỉ truy cập

Các URL dưới đây dùng IP của máy demo:

| Dịch vụ | URL |
|---|---|
| Website | http://192.168.244.130:8080 |
| pgAdmin | http://192.168.244.130:5050 |
| Grafana | http://192.168.244.130:3001 |
| Prometheus | http://192.168.244.130:9091 |

Backend health check trên máy triển khai:

```bash
curl http://127.0.0.1:3001/health
```

Kết quả mong đợi:

```json
{"status":"ok","database":"connected"}
```

## 7. Kết nối PostgreSQL bằng pgAdmin

Đăng nhập pgAdmin bằng tài khoản đã khởi tạo.

Đăng ký server PostgreSQL:

| Trường | Giá trị |
|---|---|
| Name | Clinic PostgreSQL |
| Host name/address | postgres |
| Port | 5432 |
| Maintenance database | clinic_db |
| Username | Giá trị POSTGRES_USER |
| Password | Giá trị POSTGRES_PASSWORD |

pgAdmin nằm trong Docker network nên dùng host `postgres`
và cổng nội bộ `5432`, không dùng cổng host `5433`.

Tài khoản đăng nhập pgAdmin khác tài khoản kết nối PostgreSQL.
Thay biến mật khẩu trong `.env` không tự đổi mật khẩu đã lưu
trong database hoặc volume pgAdmin hiện có.

Xem các lịch hẹn mới nhất bằng Query Tool:

```sql
SELECT *
FROM public.appointments
ORDER BY id DESC;
```

## 8. Prometheus và Grafana

Trong Grafana, tạo datasource Prometheus:

```text
http://prometheus:9090
```

Datasource Loki:

```text
http://loki:3100
```

Đăng nhập Grafana bằng tài khoản quản trị đã thiết lập.
Với cài đặt mới dùng thông tin mặc định của image, đổi mật khẩu
quản trị ngay sau khi đăng nhập lần đầu.

Import dashboard:

```text
grafana/dashboards/clinic-appointment-monitoring.json
```

File dashboard dùng định dạng Grafana v2 và tham chiếu
datasource UID `fg03td5a8hgxsd`. Khi import sang máy mới,
kiểm tra khả năng hỗ trợ định dạng và liên kết các panel
với datasource Prometheus vừa tạo.

Dashboard gồm:

- Trạng thái scrape các target: `up`.
- CPU Usage.
- RAM Usage.
- Docker Container CPU Usage.
- Số kết nối PostgreSQL: `pg_stat_database_numbackends`.

Trong Prometheus, kiểm tra:

```promql
up
```

```promql
pg_up
```

```promql
probe_success{job="clinic-web"}
```

Giá trị `1` lần lượt thể hiện scrape thành công, exporter
kết nối được PostgreSQL và probe website thành công.

Blackbox hiện kiểm tra trang chủ Nginx; kết quả này không
thay thế kiểm tra backend và kết nối DB.

## 9. Log tập trung

Trong Grafana → Explore → chọn datasource Loki.

Ba truy vấn demo:

```logql
{container="clinic_nginx"}
```

```logql
{container="clinic_nginx"} |= "/api/"
```

```logql
{container="clinic_postgres"}
```

Truy cập website hoặc gọi API để tạo log mới.
Chọn khoảng thời gian có hoạt động, ví dụ Last 30 minutes.

## 10. Các biện pháp hardening đã áp dụng

- Backend chạy bằng user `node`, không phải root.
- Cổng backend và PostgreSQL chỉ bind trên localhost.
- Dịch vụ giao tiếp qua Docker bridge network của dự án.
- Frontend và file cấu hình được mount chỉ đọc.
- `.env` được loại khỏi Git.
- Nginx có X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy và Content-Security-Policy.

Kiểm tra headers:

```bash
curl -I http://192.168.244.130:8080/
```

Giới hạn hiện tại:

- Tất cả dịch vụ dùng chung một Docker network.
- cAdvisor có quyền privileged.
- Promtail truy cập Docker socket.
- Loki không bật xác thực và có cổng truy cập từ LAN.
- API cập nhật trạng thái lịch hẹn chưa kiểm tra quyền.
- Tài khoản mẫu dùng password hash demo, không phục vụ
  chức năng đăng nhập thật.

## 11. Kiểm thử và demo

1. Kiểm tra container bằng `docker compose ps -a`.
2. Mở website, chọn dịch vụ, bác sĩ và giờ tương lai.
3. Nhập thông tin khách hàng và gửi đặt lịch.
4. Kiểm tra màn hình thành công và mã lịch hẹn.
5. Tìm mã tương ứng trong pgAdmin.
6. Kiểm tra ngày cũ bị chặn và giờ đã qua không được đặt.
7. Kiểm tra khung giờ đã đặt không còn được chọn.
8. Mở dashboard Grafana và kiểm tra metrics.
9. Chạy ba truy vấn LogQL.
10. Kiểm tra security headers.

## 12. Lưu trữ và giới hạn dựng lại

Dữ liệu được lưu trong các named volume của Docker Compose.

```bash
docker compose stop
docker compose start
```

Dừng và gỡ container/network mà vẫn giữ named volume:

```bash
docker compose down
```

Không dùng `docker compose down -v` nếu cần giữ dữ liệu.

Database đang demo có trigger `clinic_future_appointment`
chặn thời gian đã qua. Trigger này chưa được lưu trong các
file SQL đã kiểm tra của repo, nên DB mới chưa tự có trigger.
Backend vẫn có kiểm tra thời gian riêng.

Dashboard và datasource đang chạy được lưu trong volume
Grafana. File JSON cần được import và liên kết datasource
khi dựng hệ thống mới.
