#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::fs;
use std::path::Path;
use serde::{Serialize, Deserialize};
use std::sync::Mutex;
use std::collections::VecDeque;
use std::io::Write;
use std::panic;
use std::fs::OpenOptions;

#[cfg(target_os = "windows")]
use winapi::um::fileapi::{GetFileAttributesW};
#[cfg(target_os = "windows")]
use winapi::um::winnt::{FILE_ATTRIBUTE_HIDDEN};
#[cfg(target_os = "windows")]
use std::os::windows::ffi::OsStrExt;

// 로그 메시지를 저장할 전역 변수
struct LogState {
    messages: VecDeque<LogMessage>,
}

#[derive(Clone, Serialize)]
struct LogMessage {
    level: String,
    message: String,
    timestamp: String,
}

impl LogState {
    fn new() -> Self {
        Self {
            messages: VecDeque::with_capacity(1000), // 최대 1000개 메시지 저장
        }
    }

    fn add_message(&mut self, level: &str, message: &str) {
        let now = chrono::Local::now();
        let timestamp = now.format("%Y-%m-%d %H:%M:%S").to_string();
        
        let log_message = LogMessage {
            level: level.to_string(),
            message: message.to_string(),
            timestamp,
        };
        
        // 최대 크기를 초과하면 가장 오래된 메시지 제거
        if self.messages.len() >= 1000 {
            self.messages.pop_front();
        }
        
        self.messages.push_back(log_message);
    }

    fn get_messages(&self) -> Vec<LogMessage> {
        self.messages.iter().cloned().collect()
    }
}

// 전역 로그 상태 관리
lazy_static::lazy_static! {
    static ref LOG_STATE: Mutex<LogState> = Mutex::new(LogState::new());
}

// 로그 파일 경로 가져오기
fn get_log_file_path() -> std::path::PathBuf {
    let mut path = std::env::current_exe().unwrap_or_default();
    path.pop(); // 실행 파일 이름 제거
    path.push("maulwurf_log.txt");
    path
}

// 파일에 로그 기록
fn log_to_file(level: &str, message: &str) {
    let log_path = get_log_file_path();
    
    let now = chrono::Local::now();
    let timestamp = now.format("%Y-%m-%d %H:%M:%S").to_string();
    let log_entry = format!("[{}] [{}] {}\n", timestamp, level, message);
    
    let mut file = match OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path) {
            Ok(file) => file,
            Err(e) => {
                eprintln!("로그 파일 열기 실패: {}", e);
                return;
            }
        };
    
    if let Err(e) = file.write_all(log_entry.as_bytes()) {
        eprintln!("로그 파일 쓰기 실패: {}", e);
    }
}

// 로그 추가 함수 수정
fn add_log(level: &str, message: &str) {
    println!("LOG: [{}] {}", level, message);
    // 메모리 로그에 추가
    if let Ok(mut state) = LOG_STATE.lock() {
        state.add_message(level, message);
    }
    
    // 파일에 로그 기록
    log_to_file(level, message);
}

// 로그 메시지 가져오기 명령
#[tauri::command]
fn get_logs() -> Vec<LogMessage> {
    if let Ok(state) = LOG_STATE.lock() {
        state.get_messages()
    } else {
        Vec::new()
    }
}

// 로그 추가 명령
#[tauri::command]
fn add_log_message(level: &str, message: &str) {
    add_log(level, message);
}

// 설정 구조체
#[derive(Serialize, Deserialize, Clone, Debug)]
struct AppSettings {
    last_folder_path: String,
    favorite_folders: Vec<String>,
    font_family: String,
    font_size: i32,
    word_wrap: bool,
    show_line_numbers: bool,
    show_minimap: bool,
    theme: String,
    accessible_folders: Vec<String>, // 접근 가능한 폴더 목록
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            last_folder_path: "C:\\".to_string(),
            favorite_folders: vec![],
            font_family: "Consolas".to_string(),
            font_size: 18,
            word_wrap: false,
            show_line_numbers: true,
            show_minimap: true,
            theme: "dark".to_string(),
            accessible_folders: vec!["C:\\".to_string(), "D:\\".to_string()],
        }
    }
}

// 전역 설정 상태
lazy_static::lazy_static! {
    static ref APP_SETTINGS: Mutex<AppSettings> = Mutex::new(AppSettings::default());
}

// 설정 파일 경로 가져오기
fn get_settings_file_path() -> std::path::PathBuf {
    let mut path = std::env::current_exe().unwrap_or_default();
    path.pop(); // 실행 파일 이름 제거
    path.push("maulwurf_settings.json");
    path
}

// 설정 저장 함수
fn save_settings() -> Result<(), String> {
    let settings = match APP_SETTINGS.lock() {
        Ok(settings) => settings.clone(),
        Err(_) => return Err("설정 데이터 잠금 획득 실패".to_string()),
    };
    
    let settings_path = get_settings_file_path();
    let settings_json = match serde_json::to_string_pretty(&settings) {
        Ok(json) => json,
        Err(e) => return Err(format!("설정 직렬화 실패: {}", e)),
    };
    
    let mut file = match std::fs::File::create(&settings_path) {
        Ok(file) => file,
        Err(e) => return Err(format!("설정 파일 생성 실패: {}", e)),
    };
    
    match file.write_all(settings_json.as_bytes()) {
        Ok(_) => {
            add_log("info", &format!("설정 저장 성공: {}", settings_path.display()));
            Ok(())
        },
        Err(e) => Err(format!("설정 파일 쓰기 실패: {}", e)),
    }
}

// 설정 로드 함수
fn load_settings() -> Result<(), String> {
    let settings_path = get_settings_file_path();
    
    if !settings_path.exists() {
        add_log("info", "설정 파일이 없어 기본 설정을 사용합니다.");
        return save_settings(); // 기본 설정 저장
    }
    
    let settings_json = match std::fs::read_to_string(&settings_path) {
        Ok(json) => json,
        Err(e) => return Err(format!("설정 파일 읽기 실패: {}", e)),
    };
    
    let settings: AppSettings = match serde_json::from_str(&settings_json) {
        Ok(settings) => settings,
        Err(e) => return Err(format!("설정 역직렬화 실패: {}", e)),
    };
    
    if let Ok(mut app_settings) = APP_SETTINGS.lock() {
        *app_settings = settings;
        add_log("info", &format!("설정 로드 성공: {}", settings_path.display()));
        Ok(())
    } else {
        Err("설정 데이터 잠금 획득 실패".to_string())
    }
}

// 설정 가져오기 명령
#[tauri::command]
fn get_settings() -> Result<AppSettings, String> {
    match APP_SETTINGS.lock() {
        Ok(settings) => Ok(settings.clone()),
        Err(_) => Err("설정 데이터 잠금 획득 실패".to_string()),
    }
}

// 설정 업데이트 명령
#[tauri::command]
fn update_settings(settings: AppSettings) -> Result<(), String> {
    if let Ok(mut app_settings) = APP_SETTINGS.lock() {
        *app_settings = settings;
        save_settings()?;
        add_log("info", "설정이 업데이트되었습니다.");
        Ok(())
    } else {
        Err("설정 데이터 잠금 획득 실패".to_string())
    }
}

// 마지막 폴더 경로 업데이트 명령
#[tauri::command]
fn update_last_folder_path(path: &str) -> Result<(), String> {
    if let Ok(mut settings) = APP_SETTINGS.lock() {
        settings.last_folder_path = path.to_string();
        save_settings()?;
        add_log("info", &format!("마지막 폴더 경로 업데이트: {}", path));
        Ok(())
    } else {
        Err("설정 데이터 잠금 획득 실패".to_string())
    }
}

// 즐겨찾기 폴더 추가 명령
#[tauri::command]
fn add_favorite_folder(path: &str) -> Result<(), String> {
    if let Ok(mut settings) = APP_SETTINGS.lock() {
        if !settings.favorite_folders.contains(&path.to_string()) {
            settings.favorite_folders.push(path.to_string());
            save_settings()?;
            add_log("info", &format!("즐겨찾기 폴더 추가: {}", path));
        }
        Ok(())
    } else {
        Err("설정 데이터 잠금 획득 실패".to_string())
    }
}

// 즐겨찾기 폴더 제거 명령
#[tauri::command]
fn remove_favorite_folder(path: &str) -> Result<(), String> {
    if let Ok(mut settings) = APP_SETTINGS.lock() {
        settings.favorite_folders.retain(|p| p != path);
        save_settings()?;
        add_log("info", &format!("즐겨찾기 폴더 제거: {}", path));
        Ok(())
    } else {
        Err("설정 데이터 잠금 획득 실패".to_string())
    }
}

// 접근 가능한 폴더 추가 명령
#[tauri::command]
fn add_accessible_folder(path: &str) -> Result<(), String> {
    if let Ok(mut settings) = APP_SETTINGS.lock() {
        // 이미 목록에 있는지 확인
        if !settings.accessible_folders.contains(&path.to_string()) {
            settings.accessible_folders.push(path.to_string());
            save_settings()?;
            add_log("info", &format!("접근 가능한 폴더 추가: {}", path));
        }
        Ok(())
    } else {
        Err("설정 데이터 잠금 획득 실패".to_string())
    }
}

// 파일 엔트리 구조체
#[derive(Serialize, Clone)]
struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
    hidden: bool,
}

// 윈도우에서 파일이 숨김 상태인지 확인하는 함수
#[cfg(target_os = "windows")]
fn is_hidden_windows(path: &Path) -> bool {
    use std::ffi::OsStr;
    let wide_path: Vec<u16> = OsStr::new(path)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    
    unsafe {
        let attributes = GetFileAttributesW(wide_path.as_ptr());
        if attributes == u32::MAX {
            return false;
        }
        (attributes & FILE_ATTRIBUTE_HIDDEN) != 0
    }
}

// 윈도우가 아닌 시스템에서의 숨김 파일 확인 (항상 false 반환)
#[cfg(not(target_os = "windows"))]
fn is_hidden_windows(_path: &Path) -> bool {
    false
}

// 디렉토리 내용을 읽는 명령 - 안정성 개선
#[tauri::command]
fn read_dir(path: String) -> Result<Vec<FileEntry>, String> {
    let path = Path::new(&path);
    
    println!("디렉토리 읽기 시도: {}", path.display());
    add_log("info", &format!("디렉토리 읽기 시도: {}", path.display()));
    
    // 드라이브 루트인지 확인 (예: "C:\")
    let is_drive_root = path.to_string_lossy().to_string().matches(r"^[A-Z]:\\$").count() > 0;
    
    if is_drive_root {
        println!("드라이브 루트 접근: {}", path.display());
        add_log("info", &format!("드라이브 루트 접근: {}", path.display()));
        
        // 드라이브 루트인 경우 특별 처리
        return read_drive_root(path);
    }
    
    if !path.exists() {
        let error_msg = format!("경로가 존재하지 않습니다: {}", path.display());
        add_log("error", &error_msg);
        return Err(error_msg);
    }
    
    if !path.is_dir() {
        let error_msg = format!("경로가 디렉토리가 아닙니다: {}", path.display());
        add_log("error", &error_msg);
        return Err(error_msg);
    }
    
    // 안전하게 디렉토리 읽기 시도
    match safe_read_dir(path) {
        Ok(entries) => {
            // 성공적으로 읽었으면 마지막 폴더 경로 업데이트
            let _ = update_last_folder_path(path.to_str().unwrap_or(""));
            add_log("info", &format!("디렉토리 읽기 성공: {} (항목 수: {})", path.display(), entries.len()));
            Ok(entries)
        },
        Err(e) => {
            add_log("error", &format!("디렉토리 읽기 실패: {}: {}", path.display(), e));
            Err(e)
        }
    }
}

// 드라이브 루트 읽기 (예: "C:\")
fn read_drive_root(path: &Path) -> Result<Vec<FileEntry>, String> {
    let drive_letter = path.to_string_lossy().chars().next().unwrap_or('C');
    
    // 드라이브 루트 경로 (예: "C:\")
    let root_path = format!("{}:\\", drive_letter);
    
    println!("드라이브 루트 접근 요청: {}", root_path);
    add_log("info", &format!("드라이브 루트 접근 요청: {}", root_path));
    
    // 성능 및 안정성을 위해 기본 Windows 폴더 목록 반환
    let default_folders = vec![
        FileEntry {
            name: "Program Files".to_string(),
            path: format!("{}:\\Program Files", drive_letter),
            is_dir: true,
            hidden: false,
        },
        FileEntry {
            name: "Program Files (x86)".to_string(),
            path: format!("{}:\\Program Files (x86)", drive_letter),
            is_dir: true,
            hidden: false,
        },
        FileEntry {
            name: "Users".to_string(),
            path: format!("{}:\\Users", drive_letter),
            is_dir: true,
            hidden: false,
        },
        FileEntry {
            name: "Windows".to_string(),
            path: format!("{}:\\Windows", drive_letter),
            is_dir: true,
            hidden: false,
        },
    ];
    
    add_log("info", &format!("드라이브 루트 기본 폴더 목록 반환: {} (항목 수: {})", root_path, default_folders.len()));
    Ok(default_folders)
}

// 안전하게 디렉토리 읽기 (오류 처리 포함)
fn safe_read_dir(path: &Path) -> Result<Vec<FileEntry>, String> {
    // 타임아웃 설정 (실제로는 Rust에서 직접적인 타임아웃 설정이 어려움)
    // 대신 안전하게 읽기 시도
    
    let entries = match fs::read_dir(path) {
        Ok(entries) => entries,
        Err(e) => {
            let error_msg = format!("디렉토리 읽기 오류: {}: {}", path.display(), e);
            add_log("error", &error_msg);
            return Err(error_msg);
        }
    };
    
    let mut file_entries = Vec::new();
    
    // 각 항목 처리
    for entry in entries {
        match entry {
            Ok(entry) => {
                let path = entry.path();
                let file_name = match path.file_name() {
                    Some(name) => name.to_string_lossy().to_string(),
                    None => continue, // 파일 이름이 없으면 건너뜀
                };
                
                // 숨김 파일 여부 확인
                let hidden = is_hidden_windows(&path);
                
                // 디렉토리 여부 확인
                let is_dir = match path.is_dir() {
                    true => true,
                    false => false,
                };
                
                file_entries.push(FileEntry {
                    name: file_name,
                    path: path.to_string_lossy().to_string(),
                    is_dir,
                    hidden,
                });
            },
            Err(_) => continue, // 오류가 있는 항목은 건너뜀
        }
    }
    
    // 결과 반환
    Ok(file_entries)
}

// 시스템 폰트 목록을 가져오는 명령 (간소화된 버전)
#[tauri::command]
fn get_system_fonts() -> Vec<String> {
    // 기본 폰트 목록 반환
    vec![
        "Consolas".to_string(),
        "Courier New".to_string(),
        "Lucida Console".to_string(),
        "Monaco".to_string(),
        "Menlo".to_string(),
        "Source Code Pro".to_string(),
        "Fira Code".to_string(),
        "Roboto Mono".to_string(),
        "Ubuntu Mono".to_string(),
        "Nanum Gothic Coding".to_string(),
        "D2Coding".to_string(),
        "Noto Sans KR".to_string(),
        "Arial".to_string(),
        "Verdana".to_string(),
        "Tahoma".to_string(),
        "Times New Roman".to_string(),
        "Georgia".to_string(),
        "Segoe UI".to_string(),
        "Calibri".to_string(),
        "Cambria".to_string(),
        "Helvetica".to_string(),
        "Meiryo".to_string(),
        "MS Gothic".to_string(),
        "MS PGothic".to_string(),
        "MS Mincho".to_string(),
        "MS PMincho".to_string(),
        "Malgun Gothic".to_string(),
        "Gulim".to_string(),
        "Dotum".to_string(),
        "Batang".to_string(),
    ]
}

// 파일 관련 명령어를 처리하는 함수들
#[tauri::command]
fn greet(name: &str) -> String {
    format!("안녕하세요, {}님! Maulwurf G코드 에디터에 오신 것을 환영합니다!", name)
}

#[tauri::command]
fn is_directory(path: &str) -> bool {
    let path = std::path::Path::new(path);
    path.is_dir()
}

#[tauri::command]
fn get_dropped_file_path(file_path: &str) -> String {
    // 드롭된 파일 경로 반환
    // 웹에서 드래그된 파일은 경로가 없을 수 있으므로 이 함수를 통해 처리
    file_path.to_string()
}

fn main() {
    println!("Starting Tauri application...");
    
    // 패닉 핸들러 설정
    panic::set_hook(Box::new(|panic_info| {
        println!("Application panic occurred: {:?}", panic_info);
        // 기존 로그 코드가 있다면 유지
    }));
    
    tauri::Builder::default()
        .manage(Mutex::new(LogState::new()))
        .manage(Mutex::new(AppSettings::default()))
        .invoke_handler(tauri::generate_handler![
            greet,
            read_dir,
            get_system_fonts,
            get_settings,
            update_settings,
            update_last_folder_path,
            add_favorite_folder,
            remove_favorite_folder,
            add_accessible_folder,
            is_directory,
            get_dropped_file_path,
            get_logs,
            add_log_message,
        ])
        .setup(|_app| {
            println!("Tauri app setup complete");
            // 로그 파일 초기화
            let log_path = get_log_file_path();
            println!("Log file path: {:?}", log_path);
            
            // 설정 파일 로드
            match load_settings() {
                Ok(_) => println!("Settings loaded successfully"),
                Err(e) => println!("Failed to load settings: {}", e),
            }
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
} 