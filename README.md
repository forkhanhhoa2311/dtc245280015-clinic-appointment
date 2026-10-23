# DTC245280015
# Nguyen Thi Khanh Hoa
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

Các dịch vụ được phân chia vào những mạng Docker riêng theo chức năng ứng dụng, quản trị và giám sát nhằm hạn chế kết nối không cần thiết giữa các dịch vụ.

## 3. Yêu cầu môi trường

- Máy Linux có Docker Engine và Docker Compose plugin.
- Git và OpenSSL.
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
APP_DB_USER=clinic_app
APP_DB_PASSWORD=<mat_khau_ung_dung_rieng>
MONITOR_DB_USER=clinic_monitor
MONITOR_DB_PASSWORD=<mat_khau_giam_sat_rieng>
GRAFANA_ADMIN_PASSWORD=<mat_khau_Grafana_manh>

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

Trước lần khởi động đầu tiên, chạy:
    sh scripts/create-certs.sh 192.168.244.130

Nếu đổi IP máy triển khai, cập nhật IP trong Compose và chứng chỉ.
Chứng chỉ tự ký có thể khiến trình duyệt cảnh báo chưa tin cậy.
Không đưa khóa riêng nginx/certs/selfsigned.key lên GitHub.


```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps -a
```

Khi volume PostgreSQL mới còn trống, các script tự chạy theo thứ tự:
1. init.sql tạo bảng và index.
2. database/02-roles.sh tạo role và cấp quyền.
3. database/seed.sql nạp dữ liệu mẫu.
4. database/04-trigger.sql tạo trigger chặn giờ quá khứ.
5. database/05-doctor-services.sql tạo quan hệ bác sĩ và dịch vụ.
6. database/06-consultation-doctor.sql thêm bác sĩ tư vấn và khung giờ.

Database đã tồn tại không tự chạy lại các script khởi tạo.
Cần sao lưu và áp dụng cập nhật phù hợp cho database cũ.
Không xóa volume dữ liệu để chạy lại các script.

Seed cung cấp dữ liệu demo và một số khung giờ theo ngày
tương đối tại thời điểm chạy. Không bảo đảm mọi bác sĩ có lịch
cho mọi ngày.

Không cần nạp lại seed chỉ để khởi động hệ thống đã có dữ liệu.

## 6. Địa chỉ truy cập

Các URL dưới đây dùng IP của máy demo:

| Dịch vụ | URL |
|---|---|
| Website HTTP | http://192.168.244.130:8080 |
| Website HTTPS | https://192.168.244.130:8443 |
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

Với volume Grafana mới, username là admin và mật khẩu lấy từ
GRAFANA_ADMIN_PASSWORD trong .env. Thay biến này không tự đổi
mật khẩu tài khoản đã tồn tại trong volume Grafana.

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

Blackbox kiểm tra trang chủ Nginx và API /health.
Dùng probe_success để kiểm tra cả clinic-web và clinic-api.
up = 1 chỉ thể hiện scrape thành công.
probe_success = 1 thể hiện probe đích thành công.
API /health kiểm tra kết nối database bằng SELECT 1.

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

### 10.1. Các biện pháp đã áp dụng

- Giới hạn quyền backend:Backend chạy bằng tài khoản `node`, không chạy bằng quyền root.
- Giới hạn cổng truy cập: Backend và PostgreSQL chỉ bind cổng host trên địa chỉ `127.0.0.1`.
- Phân tách mạng Docker: Các dịch vụ được phân chia vào các mạng theo chức năng ứng dụng, quản trị và giám sát nhằm hạn chế kết nối không cần thiết.
- Bảo vệ thông tin cấu hình: Tệp `.env` được Git bỏ qua để tránh đưa thông tin nhạy cảm lên kho mã nguồn.
- Bảo vệ giao diện web: Nginx được cấu hình các HTTP Security Headers, gồm `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` và `Content-Security-Policy`.
- Giảm quyền cAdvisor: cAdvisor không chạy ở chế độ `privileged`. Kết quả kiểm tra xác nhận `privileged=false`.
- Kiểm tra giám sát: Container cAdvisor ở trạng thái `healthy`; Prometheus ghi nhận target `cadvisor` ở trạng thái `up`.

### 10.2. Kiểm tra cấu hình bảo mật

Kiểm tra cấu hình Docker Compose:

```bash
docker compose config --quiet
```

Kiểm tra các HTTP Security Headers:

```bash
curl -I http://192.168.244.130:8080/
```

Kiểm tra quyền của cAdvisor:

```bash
docker inspect -f 'privileged={{.HostConfig.Privileged}}' clinic_cadvisor
```

Kết quả mong đợi:

```text
privileged=false
```

Kiểm tra trạng thái các container:

```bash
docker compose ps
```

Kiểm tra target cAdvisor tại giao diện Prometheus, mục **Status → Targets**. Target `cadvisor` cần có trạng thái `UP`.

### 10.3. Những điểm cần lưu ý

- Các giao diện pgAdmin, Prometheus và Grafana đang được công khai trên địa chỉ mạng của máy triển khai. Cần giới hạn máy được phép truy cập bằng tường lửa và sử dụng cơ chế xác thực phù hợp.
- Loki không publish cổng ra host; Grafana và Promtail truy cập qua mạng Docker. Loki chưa bật xác thực tại dịch vụ.
- Promtail có quyền truy cập nguồn log Docker. Cần giới hạn quyền truy cập và chỉ mount những tài nguyên thực sự cần thiết.
- Không đưa mật khẩu, khóa API hoặc thông tin bí mật vào GitHub.
- Hệ thống hiện phục vụ mục đích học tập và demo; cần đánh giá thêm quyền truy cập API, xác thực và phân quyền trước khi triển khai thực tế.

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

Trigger clinic_future_appointment được lưu trong database/04-trigger.sql
và tự tạo khi khởi tạo database mới. Backend cũng kiểm tra giờ quá khứ.

Dashboard và datasource đang chạy được lưu trong volume
Grafana. File JSON cần được import và liên kết datasource
khi dựng hệ thống mới.
