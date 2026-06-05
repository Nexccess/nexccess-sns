Python
import os
import requests

# FacebookページID（合同会社Nexccess）
FB_PAGE_ID = "2142442919852299" 
FB_ACCESS_TOKEN = os.getenv("FB_ACCESS_TOKEN")

def post_to_facebook(message, link, image_url=None):
    """
    Facebook個別投稿
    """
    url = f"https://graph.facebook.com/v18.0/{FB_PAGE_ID}/feed"
    
    payload = {
        "message": message,
        "link": link,
        "access_token": FB_ACCESS_TOKEN
    }
    
    if image_url:
        payload["picture"] = image_url
    
    response = requests.post(url, data=payload)
    
    if response.status_code == 200:
        post_id = response.json()["id"]
        print(f"✅ Facebook投稿成功: https://www.facebook.com/{post_id}")
        return post_id
    else:
        print(f"❌ エラー: {response.text}")
        return None

if __name__ == "__main__":
    # テスト投稿用
    post_to_facebook(
        message="""【創業融資のノウハウ】
日本政策金融公庫の創業融資なら、自己資金が少なくても最大3,000万円まで融資を受けられる可能性があります。

・無担保・無保証人OK
・審査通過率を上げるコツ

詳細はこちらからご確認ください。""",
        link="https://www.seisakukinyukouko.site/"
    )
