use std::fs;
use std::io::Write;
use std::path::Path;
use tauri::command;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// 1. Define the Input Structure for the Zip Command
#[derive(serde::Deserialize)]
struct ZipFileEntry {
    path: String,                // The name of the file inside the zip (e.g., "media/video.mp4")
    content: Option<String>,     // For text files: The actual string content
    source_path: Option<String>, // For large files: The path on disk to stream from
}

// 2. The Export Command (Runs on a separate thread to prevent UI freezing)
#[command]
async fn export_project_zip(zip_path: String, entries: Vec<ZipFileEntry>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = Path::new(&zip_path);
        
        // Create the zip file
        let file = File::create(&path).map_err(|e| format!("Failed to create zip file: {}", e))?;
        let mut zip = zip::ZipWriter::new(file);
        
        // FIX: Use SimpleFileOptions to avoid "E0283 type annotations needed"
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Stored)
            .unix_permissions(0o755);

        for entry in entries {
            // Start a new file inside the zip
            zip.start_file(&entry.path, options)
                .map_err(|e| format!("Zip error for {}: {}", entry.path, e))?;

            // CASE A: Large File (Stream from Disk)
            if let Some(src) = entry.source_path {
                let mut f = File::open(&src).map_err(|e| format!("Failed to open source {}: {}", src, e))?;
                // Stream copy to avoid loading into RAM
                std::io::copy(&mut f, &mut zip).map_err(|e| format!("Failed to copy {}: {}", src, e))?;
            } 
            // CASE B: Text Content (Write String)
            else if let Some(content) = entry.content {
                zip.write_all(content.as_bytes())
                    .map_err(|e| format!("Failed to write content for {}: {}", entry.path, e))?;
            }
        }

        zip.finish().map_err(|e| format!("Failed to finalize zip: {}", e))?;
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        // Register the new command here alongside 'greet'
        .invoke_handler(tauri::generate_handler![greet, export_project_zip]) 
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}