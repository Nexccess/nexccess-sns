import os
import sys
import json
import requests
from google import genai
from google.genai import types

# 既存スクリプトのインポートパス不整合を回避する修正
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from post_to_note import post_to_note
from post_to_facebook import post_to_facebook

# X（旧Twitter）スクリプトが存在する場合のみインポート
try:
    from post_to_x import post_to_x
except ImportError:
    post_to_x = None

# Gemini APIクライアント初期化（認証情報は自動読み込み）
client = genai.Client()

def generate_content_with_gemini(article_info, platform):
    """
    Geminiを利用して媒体別のトーン＆マナーに沿った投稿文を生成する
    """
    prompt = f"""
以下の記事情報をベースに、指定されたSNSプラットフォーム向けの最適な投稿文を生成してください。

【記事情報】
・タイトル: {article_info.get('title')}
・ターゲット顧客の悩み: {', '.join(article_info.get('pain_points', []))}
・ターゲットペルソナ: {article_info.get('target_persona')}
・対象カテゴリ: {article_info.get('category')}

【指定プラットフォーム】
{platform.upper()}

【出力ルール】
- 挨拶や余計な前置き（「はい、生成しました」等）は一切出力せず、投稿本文のみを出力すること。
- プラットフォームの特性（Xなら140文字以内、NoteならMarkdown長文、Facebookなら信頼感のある丁寧な中長文）を厳守すること。
"""

    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )
        return response.text.strip()
    except Exception as e:
        print(f"❌ Gemini生成エラー ({platform}): {e}")
        return None

def main():
    # テスト用ダミーデータ
    mock_article = {
        "id": "fund_001",
        "title": "日本政策金融公庫の創業融資を100%通すための準備リスト",
        "pain_points": ["審査に落ちるのが怖い", "必要書類が分からない", "自己資金が少ない"],
        "target_persona": "起業家",
        "category": "資金調達",
        "target_lp": "https://www.seisakukinyukouko.site/"
    }
    
    target_lp = mock_article["target_lp"]
    
    print("🤖 Geminiによるコンテンツ生成を開始します...")
    
    # 1. Note向け生成＆投稿
    note_text = generate_content_with_gemini(mock_article, "note")
    if note_text:
        post_to_note(mock_article["title"], note_text, ["起業", "資金調達", "融資"], target_lp)
        
    # 2. Facebook向け生成＆投稿
    fb_text = generate_content_with_gemini(mock_article, "facebook")
    if fb_text:
        post_to_facebook(fb_text, target_lp)
        
    # 3. X向け生成＆投稿（スクリプトが存在する場合のみ動作）
    if post_to_x:
        x_text = generate_content_with_gemini(mock_article, "x")
        if x_text:
            post_to_x(x_text)
    else:
        print("ℹ️ post_to_x が配置されていないため、X投稿はスキップします。")

if __name__ == "__main__":
    main()
