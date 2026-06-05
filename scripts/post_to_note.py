```python
import os
import requests
from datetime import datetime
import json

NOTE_SESSION_ID = os.getenv("NOTE_SESSION_ID")

def post_to_note(title, content, hashtags, target_lp_url):
    """
    Note投稿（ブラウザセッション利用）
    """
    note_content = f"""
{content}

---

## 📌 無料で相談してみる

{target_lp_url}?utm_source=note&utm_medium=article&utm_campaign=auto

このような課題をお持ちではありませんか？
・資金調達の方法が分からない
・補助金・助成金の情報が欲しい
・専門家に相談したい

**完全無料**でご相談いただけます。
[👉 今すぐ公式LINEで相談する](https://lin.ee/7LtEtnr)

---

{" ".join([f"#{tag}" for tag in hashtags])}
"""
    
    url = "https://note.com/api/v2/notes"
    
    headers = {
        "Content-Type": "application/json",
        "Cookie": f"_note_session_id={NOTE_SESSION_ID}",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    payload = {
        "note": {
            "name": title,
            "body": note_content,
            "status": "published",
            "note_type": "text_note"
        }
    }
    
    response = requests.post(url, headers=headers, json=payload)
    
    if response.status_code == 200:
        note_url = response.json()["data"]["note_url"]
        print(f"✅ Note投稿成功: {note_url}")
        return note_url
    else:
        print(f"❌ エラー: {response.text}")
        return None

if __name__ == "__main__":
    # テスト実行用
    post_to_note(
        title="創業融資を100%通すための準備リスト",
        content="起業時の資金調達で最も重要なのは...",
        hashtags=["起業", "資金調達", "創業融資"],
        target_lp_url="https://www.seisakukinyukouko.site/"
    )
