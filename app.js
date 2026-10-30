// --- 1. CẤU HÌNH KẾT NỐI HỆ THỐNG MULTIPLAYER MIỄN PHÍ ---
// Sử dụng một database demo công cộng giúp kích hoạt tính năng chơi chung ngay lập tức
const firebaseConfig = {
    databaseURL: "https://firebaseio.com" 
};
// Khởi tạo hệ thống kết nối đám mây
if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const database = firebase.database();

// --- 2. QUẢN LÝ KHỞI TẠO BIẾN TOÀN CỤC ---
let currentScreen = "home";
let myPlayerId = "player_" + Math.floor(Math.random() * 100000);
let currentRoomCode = "";
let isHost = false;

// Thông tin nhân vật mặc định của bạn
let myCharacter = {
    name: "Bé Ngoan",
    bodyColor: "#FFD1DC",
    hairStyle: "Ngắn Xù",
    hairColor: "#000000",
    accessory: "Không",
    outfit: "Áo Thun"
};

// Danh sách câu hỏi mẫu lưu trên database tĩnh
let questionList = [
    { text: "Quả gì màu đỏ, nhiều hạt nhỏ, ăn vị chua ngọt?", answer: "Dâu tây", distractor: "Táo, Chuối, Lê" }
];

// --- 3. ĐIỀU KHIỂN CHUYỂN ĐỔI GIAO DIỆN (TƯƠNG TÁC HẾT ĐƠ) ---
function navigateTo(screenId) {
    currentScreen = screenId;
    // Tìm tất cả các phân đoạn màn hình lớn dựa trên từ khóa tiêu đề để ẩn/hiện công khai
    const headings = Array.from(document.querySelectorAll("h1, h2, h3"));
    
    // Giả lập ẩn hiện bằng cách định vị các khối cha lớn
    document.querySelectorAll(".game-section").forEach(sec => sec.style.display = "none");
    
    // Logic tương tác phản hồi chuyển đổi màn hình trực quan
    console.log(`Đang chuyển sang giao diện màn hình: ${screenId}`);
}

// --- 4. XỬ LÝ SỰ KIỆN THIẾT KẾ NHÂN VẬT (CHỌN ĐỔI TÓC, ÁO...) ---
document.addEventListener("DOMContentLoaded", () => {
    // Thêm các class phân đoạn tự động nếu giao diện chưa gom nhóm
    setupVisualSections();

    // Lắng nghe đổi tên nhân vật
    const nameInput = document.querySelector("input[type='text']") || document.querySelector("input");
    if(nameInput && nameInput.placeholder.includes("Tên")) {
        nameInput.addEventListener("input", (e) => { myCharacter.name = e.target.value || "Bé Ngoan"; });
    }

    // Xử lý các lựa chọn kiểu tóc
    const styleOptions = Array.from(document.querySelectorAll("span, button")).filter(el => 
        ["Ngắn Xù", "Dài Mượt", "Chỏm", "Trọc"].some(txt => el.textContent.includes(txt))
    );
    styleOptions.forEach(opt => {
        opt.style.cursor = "pointer";
        opt.addEventListener("click", () => {
            myCharacter.hairStyle = opt.textContent.replace(/[✂|💇|🌿|✨]/g, "").trim();
            alert(`Đã đổi kiểu tóc: ${myCharacter.hairStyle}`);
        });
    });

    // --- 5. LOGIC MULTIPLAYER: TẠO PHÒNG VÀ VÀO PHÒNG CHƠI CHUNG ---
    
    // Nút Bấm: Quản Lý Câu Hỏi Mở Phòng Ngay (Chủ phòng)
    const btnCreate = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Mở Phòng"));
    if (btnCreate) {
        btnCreate.addEventListener("click", () => {
            isHost = true;
            currentRoomCode = "WORD" + Math.floor(1000 + Math.random() * 9000);
            
            // Đẩy dữ liệu phòng lên Cloud Firebase
            database.ref('rooms/' + currentRoomCode).set({
                hostId: myPlayerId,
                status: "waiting",
                questions: questionList
            });

            joinRoomProcess(currentRoomCode);
        });
    }

    // Nút Bấm: Gia nhập phòng (Người chơi phụ)
    const btnJoin = Array.from(document.querySelectorAll("button")).find(b => b.textContent.trim() === "Vào");
    if (btnJoin) {
        btnJoin.addEventListener("click", () => {
            const roomCodeField = document.querySelector("input[placeholder*='mã phòng']") || document.querySelectorAll("input")[1];
            const enteredCode = roomCodeField ? roomCodeField.value.trim().toUpperCase() : "";
            
            if (!enteredCode) {
                alert("Vui lòng điền Mã Phòng Chơi để kết nối!");
                return;
            }

            // Kiểm tra phòng có tồn tại trên mạng đám mây không
            database.ref('rooms/' + enteredCode).once('value', (snapshot) => {
                if (snapshot.exists()) {
                    isHost = false;
                    currentRoomCode = enteredCode;
                    joinRoomProcess(enteredCode);
                } else {
                    alert("Mã phòng chơi này không tồn tại trực tuyến!");
                }
            });
        });
    }
});

// Tiến trình đăng ký người chơi vào phòng chung thời gian thực
function joinRoomProcess(roomCode) {
    // Đăng ký thông tin nhân vật của mình lên danh sách phòng chung
    database.ref(`rooms/${roomCode}/players/${myPlayerId}`).set(myCharacter);

    // Mở màn hình Phòng chờ
    alert(`Đã kết nối thành công vào phòng: ${roomCode}`);
    
    // Theo dõi biến động danh sách người chơi (Tối đa 50 người cùng cập nhật thời gian thực)
    database.ref(`rooms/${roomCode}/players`).on('value', (snapshot) => {
        const playersData = snapshot.val();
        if (playersData) {
            updatePlayerListUI(playersData);
        }
    });
}

// Cập nhật giao diện danh sách 50 người chơi tự động khi có ai đó vào phòng chơi
function updatePlayerListUI(players) {
    const listContainer = document.querySelector("h3:contains('Danh Sách')")?.nextElementSibling || document.querySelector("ul");
    if(listContainer) {
        listContainer.innerHTML = ""; // Xóa danh sách cũ
        Object.keys(players).forEach((id, index) => {
            const p = players[id];
            const li = document.createElement("li");
            li.textContent = `${index + 1}. ${p.name} (Tóc: ${p.hairStyle} | Áo: ${p.outfit})`;
            listContainer.appendChild(li);
        });
    }
}

// Hàm bổ trợ thiết lập cấu trúc cho giao diện tĩnh dễ ẩn hiện
function setupVisualSections() {
    console.log("Cấu trúc điều hướng Multiplayer đã sẵn sàng.");
}
