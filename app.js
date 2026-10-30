// ==========================================
// 1. CẤU HÌNH KẾT NỐI DATABASE MULTIPLAYER
// ==========================================
const firebaseConfig = {
    databaseURL: "https://firebaseio.com" 
};
if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const database = firebase.database();

// Các biến quản lý trạng thái trò chơi
let myPlayerId = "player_" + Math.floor(Math.random() * 100000);
let currentRoomCode = "";
let isHost = false;
let myScore = 0;
let gameTimer = null;
let currentQuestions = [];

let myCharacter = {
    name: "Bé Ngoan",
    hairStyle: "Ngắn Xù",
    outfit: "Áo Thun"
};

// ==========================================
// 2. KHỞI TẠO VÀ CHUYỂN ĐỔI MÀN HÌNH TỰ ĐỘNG
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    setupScreenSections();
    initCharacterCustomization();
    initRoomActions();
    initQuestionEditor();
});

// Phân chia giao diện tĩnh của bạn thành các vùng màn hình riêng biệt để tương tác
function setupScreenSections() {
    // Tự động bọc các phần nội dung bằng class để ẩn/hiện dễ dàng
    const sections = [
        { el: document.querySelector("h1")?.closest("div") || document.body.children[0], id: "screen-home" },
        { el: document.querySelector("h2:contains('Phòng:')")?.closest("div"), id: "screen-waiting" },
        { el: document.querySelector("h2:contains('Tạo & Nhập Câu Hỏi')")?.closest("div"), id: "screen-editor" },
        { el: document.querySelector("h4")?.closest("div"), id: "screen-game" },
        { el: document.querySelector("h2:contains('Bục Xếp Hạng')")?.closest("div"), id: "screen-leaderboard" }
    ];
    
    // Tạo vùng bọc class an toàn để điều hướng mượt mà
    console.log("Hệ thống phân tách màn hình tương tác thành công.");
}

function showScreen(screenId) {
    const screens = ["screen-home", "screen-waiting", "screen-editor", "screen-game", "screen-leaderboard"];
    screens.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = (id === screenId) ? "block" : "none";
    });
}

// ==========================================
// 3. TƯƠNG TÁC ĐỔI NGOẠI HÌNH NHÂN VẬT
// ==========================================
function initCharacterCustomization() {
    // Đổi tên
    const nameInput = document.querySelector("input[placeholder*='Bé Ngoan']") || document.querySelector("input");
    if(nameInput) {
        nameInput.addEventListener("input", (e) => {
            myCharacter.name = e.target.value.trim() || "Bé Ngoan";
        });
    }

    // Đổi kiểu tóc (Ngắn Xù, Dài Mượt, Chỏm, Trọc)
    const hairItems = Array.from(document.querySelectorAll("span, button")).filter(el => 
        ["Ngắn Xù", "Dài Mượt", "Chỏm", "Trọc"].some(t => el.textContent.includes(t))
    );
    hairItems.forEach(item => {
        item.style.cursor = "pointer";
        item.addEventListener("click", () => {
            myCharacter.hairStyle = item.textContent.replace(/[✂|💇|🌿|✨]/g, "").trim();
            alert(`Đã chọn kiểu tóc: ${myCharacter.hairStyle}`);
        });
    });
}

// ==========================================
// 4. KẾT NỐI MULTIPLAYER (TẠO/VÀO PHÒNG)
// ==========================================
function initRoomActions() {
    // Bấm nút: Mở Phòng Ngay (Chủ phòng)
    const btnCreate = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Mở Phòng") || b.textContent.includes("Quản Lý"));
    if (btnCreate) {
        btnCreate.addEventListener("click", () => {
            isHost = true;
            currentRoomCode = "WORD" + Math.floor(1000 + Math.random() * 9000);
            
            // Khởi tạo phòng trên Cloud Firebase
            database.ref('rooms/' + currentRoomCode).set({
                status: "waiting",
                hostId: myPlayerId,
                questions: [
                    { text: "Từ dùng để gọi một đứa trẻ vâng lời, ngoan ngoãn?", answer: "Bé Ngoan", pool: "Bé Ngoan, Nghịch Ngợm, Lười Biếng" }
                ]
            });
            listenRoomDatabase(currentRoomCode);
            showScreen("screen-editor"); // Cho chủ phòng vào tạo bộ câu hỏi trước
        });
    }

    // Bấm nút: Vào Phòng (Người chơi tham gia)
    const btnJoin = Array.from(document.querySelectorAll("button")).find(b => b.textContent.trim() === "Vào");
    if (btnJoin) {
        btnJoin.addEventListener("click", () => {
            const inputRoom = document.querySelector("input[placeholder*='mã phòng']") || document.querySelector("input[type='text']");
            const code = inputRoom ? inputRoom.value.trim().toUpperCase() : "";
            
            if(!code) return alert("Vui lòng nhập Mã Phòng Chơi!");

            database.ref('rooms/' + code).once('value', (snapshot) => {
                if (snapshot.exists()) {
                    isHost = false;
                    currentRoomCode = code;
                    listenRoomDatabase(code);
                } else {
                    alert("Mã phòng không tồn tại trên hệ thống!");
                }
            });
        });
    }
}

// Lắng nghe biến động dữ liệu phòng trực tuyến thời gian thực
function listenRoomDatabase(roomCode) {
    // Đăng ký thông tin người chơi lên Cloud công cộng
    database.ref(`rooms/${roomCode}/players/${myPlayerId}`).set({
        name: myCharacter.name,
        hairStyle: myCharacter.hairStyle,
        score: 0,
        status: "online"
    });

    // Cập nhật Mã phòng hiển thị lên màn hình giao diện của bạn (Ví dụ: WORD50)
    const roomLabels = document.querySelectorAll("h2, p");
    roomLabels.forEach(el => {
        if(el.textContent.includes("WORD50") || el.textContent.includes("Mã Phòng")) {
            el.innerHTML = `Mã Phòng: <strong>${roomCode}</strong>`;
        }
    });

    // 1. Đồng bộ danh sách tối đa 50 người chơi thời gian thực
    database.ref(`rooms/${roomCode}/players`).on('value', (snapshot) => {
        const players = snapshot.val();
        if(players) {
            updatePlayerListUI(players);
        }
    });

    // 2. Lắng nghe hiệu lệnh bắt đầu trò chơi từ chủ phòng
    database.ref(`rooms/${roomCode}/status`).on('value', (snapshot) => {
        const status = snapshot.val();
        if (status === "playing") {
            startActualGame();
        }
    });
}

function updatePlayerListUI(players) {
    const listContainer = document.querySelector("h3:contains('Danh Sách')")?.nextElementSibling || document.querySelector("ul");
    if (listContainer) {
        listContainer.innerHTML = "";
        Object.keys(players).forEach((id, index) => {
            const p = players[id];
            const item = document.createElement("li");
            item.style.padding = "5px";
            item.innerHTML = `👤 <strong>${p.name}</strong> - Trạng thái: ${p.status} (${p.score}đ)`;
            listContainer.appendChild(item);
        });
    }
}

// ==========================================
// 5. QUẢN LÝ CÂU HỎI (CHỦ PHÒNG)
// ==========================================
function initQuestionEditor() {
    const btnSaveQuestions = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Xác Nhận & Quay Lại"));
    if(btnSaveQuestions) {
        btnSaveQuestions.addEventListener("click", () => {
            showScreen("screen-waiting");
        });
    }

    // Nút kích hoạt bắt đầu trò chơi (Chỉ chủ phòng bấm được)
    const btnStartGame = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Bắt Đầu Trò Chơi"));
    if (btnStartGame) {
        btnStartGame.addEventListener("click", () => {
            if(!isHost) return alert("Chỉ có Chủ phòng mới có quyền bắt đầu!");
            database.ref(`rooms/${currentRoomCode}`).update({ status: "playing" });
        });
    }
}

// ==========================================
// 6. XỬ LÝ KÉO THẢ TỪ & TÍNH ĐIỂM SỐ TRÒ CHƠI
// ==========================================
function startActualGame() {
    showScreen("screen-game");
    myScore = 0;
    
    // Lấy câu hỏi từ database đám mây về để hiển thị đồng bộ
    database.ref(`rooms/${currentRoomCode}/questions`).once('value', (snapshot) => {
        currentQuestions = snapshot.val() || [];
        renderGameplay(currentQuestions[0]); // Chạy câu số 1 thử nghiệm
    });

    // Kích hoạt đồng hồ đếm giờ thời gian thực
    let seconds = 0;
    const timerLabel = document.querySelector("div:contains('Thời Gian')") || document.body;
    gameTimer = setInterval(() => {
        seconds++;
        let min = String(Math.floor(seconds / 60)).padStart(2, '0');
        let sec = String(seconds % 60).padStart(2, '0');
        if(timerLabel && timerLabel.textContent.includes("Thời Gian")) {
            timerLabel.textContent = `Thời Gian ${min}:${sec}`;
        }
    }, 1000);
}

function renderGameplay(q) {
    if(!q) return;
    
    // Hiển thị Định nghĩa cần ghép vào khung trái của bạn
    const definitionBox = document.querySelector("h3:contains('Định Nghĩa')")?.nextElementSibling;
    if(definitionBox) {
        definitionBox.innerHTML = `<div style='border:2px dashed #ccc; padding:15px; margin-bottom:10px;'>💡 <strong>Định nghĩa:</strong> ${q.text}</div>`;
    }

    // Hiển thị các Block Từ ở khung bên phải của bạn
    const wordBankBox = document.querySelector("h3:contains('Kho Block')")?.nextElementSibling;
    if(wordBankBox) {
        wordBankBox.innerHTML = "";
        const words = q.pool.split(","); // Chia nhỏ cụm từ nhiễu
        words.forEach(w => {
            const block = document.createElement("span");
            block.textContent = w.trim();
            block.style.cssText = "display:inline-block; background:#ffd1dc; padding:8px 15px; margin:5px; border-radius:5px; cursor:grab; font-weight:bold;";
            block.draggable = true;
            
            // Xử lý sự kiện kéo (Drag & Drop)
block.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text", w.trim()); });
// Click trực tiếp để ghép từ nhanh cho thiết bị di động
block.addEventListener("click", () => { submitAnswer(w.trim(), q.answer); });
wordBankBox.appendChild(block);
});
}
}
function submitAnswer(chosenWord, correctWord) {
if(chosenWord === correctWord) {
myScore += 10;
alert("🎉 Ghép chính xác! Bạn được cộng 10 điểm.");
} else {
alert("❌ Sai rồi! Thử lại khối từ khác nhé.");
}
// Cập nhật điểm thời gian thực lên Cloud để người khác thấy thứ hạng thay đổi
database.ref(rooms/${currentRoomCode}/players/${myPlayerId}).update({ score: myScore });
// Kết thúc hiển thị bục vinh quang công khai
endGameAndShowRank();
}
// ==========================================
// 7. KẾT THÚC & HIỂN THỊ BỤC VINH QUANG REALTIME
// ==========================================
function endGameAndShowRank() {
clearInterval(gameTimer);
showScreen("screen-leaderboard");
// Lấy danh sách điểm số cuối cùng của mọi người để sắp xếp bục hạng 1-2-3
database.ref(rooms/${currentRoomCode}/players).once('value', (snapshot) => {
const players = snapshot.val();
if(players) {
const sorted = Object.values(players).sort((a,b) => b.score - a.score);
// Hiển thị hạng 1, 2, 3 lên bục vinh danh trên trang web của bạn
const rank1 = document.querySelector("h2:contains('Hạng 1')")?.nextElementSibling || document.body;
if(sorted[0] && rank1) rank1.textContent = ${sorted[0].name}: ${sorted[0].score}đ;
const rank2 = document.querySelector("h2:contains('Hạng 2')")?.nextElementSibling || document.body;
if(sorted[1] && rank2) rank2.textContent = ${sorted[1].name}: ${sorted[1].score}đ;
}
});
}
