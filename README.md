# MEMESLOTS — Bitcoin Meme DEX on OP_NET

---

## ⚡ QUAN TRỌNG — Tại sao không thấy nút "Run workflow"?

GitHub chỉ hiện nút **Run workflow** khi file workflow được đưa vào repo bằng **git push**, không phải drag & drop.

Làm theo đúng thứ tự bên dưới.

---

## Hướng dẫn từng bước

### Bước 1 — Tạo repo mới trên GitHub

1. Vào https://github.com/new
2. Đặt tên: `memeslots`
3. Chọn **Public**
4. **KHÔNG** tick "Add a README file"
5. Nhấn **Create repository**

---

### Bước 2 — Upload files (drag & drop)

Sau khi tạo repo, GitHub sẽ hiện trang trống với dòng chữ "uploading an existing file".

1. Giải nén file ZIP bạn tải về
2. Kéo thả **toàn bộ thư mục `memeslots-repo`** vào trang đó
3. Nhấn **Commit changes**

---

### Bước 3 — Mở Codespaces (bước quan trọng)

> Bước này bắt buộc để GitHub nhận diện workflow. Codespaces miễn phí 60 giờ/tháng.

1. Trong repo, nhấn nút xanh **`<> Code`**
2. Tab **Codespaces**
3. Nhấn **"Create codespace on main"**
4. Đợi ~30 giây cho terminal mở ra
5. Paste vào terminal:

```bash
bash setup.sh
```

Đợi script chạy xong (khoảng 10 giây).

---

### Bước 4 — Thêm Secret PRIVATE_KEY

1. Vào repo → **Settings** → **Secrets and variables** → **Actions**
2. Nhấn **New repository secret**
3. Name: `PRIVATE_KEY`
4. Value: WIF private key của ví (lấy từ OP_WALLET → Export Private Key)
5. Nhấn **Add secret**

> Lấy testnet BTC tại: https://testnet.opnet.org/faucet

---

### Bước 5 — Chạy Deploy Factory

1. Vào tab **Actions** trong repo
2. Bên trái thấy **"Deploy Factory to OP_NET"**
3. Nhấn vào → nhấn nút **"Run workflow"** bên phải
4. Chọn `testnet`
5. Nhấn **"Run workflow"** xanh

GitHub Actions sẽ tự động:
- ✅ Build WASM từ AssemblyScript contracts
- ✅ Deploy MemeFactoryV2 lên OP_NET testnet
- ✅ Cập nhật `FACTORY` address vào `web/index.html`
- ✅ Commit lại vào repo

---

### Bước 6 — Deploy web lên Vercel

1. Vào https://vercel.com/new
2. **Import Git Repository** → chọn repo `memeslots`
3. **Root Directory** → nhấn Edit → nhập `web`
4. Nhấn **Deploy**

Xong! Vercel tự redeploy mỗi khi factory address được cập nhật.

---

## Cấu trúc repo

```
memeslots/
├── .github/workflows/
│   └── deploy-factory.yml   ← Workflow chính
├── contracts/               ← Smart contracts (AssemblyScript)
│   └── assembly/contracts/
│       ├── MemeFactoryV2.ts
│       ├── RevenueSharingV2.ts
│       └── MemeToken.ts
├── scripts/
│   └── deploy-factory.mjs   ← Deploy script
├── web/
│   ├── index.html           ← Toàn bộ dApp
│   └── vercel.json
└── setup.sh                 ← Chạy 1 lần trên Codespaces
```

---

## Troubleshooting

**Không thấy "Deploy Factory to OP_NET" trong Actions?**
→ Chưa chạy `bash setup.sh` trong Codespaces. Làm lại Bước 3.

**Deploy fail: "PRIVATE_KEY is required"?**
→ Chưa thêm secret. Làm lại Bước 4.

**Deploy fail: "Balance quá thấp"?**
→ Nạp testnet BTC tại https://testnet.opnet.org/faucet

**Build fail: "Cannot find module"?**
→ Contracts có thể cần update import path. Mở issue hoặc kiểm tra `contracts/package.json`.
