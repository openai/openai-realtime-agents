import requests
import os
import json
from django.http import JsonResponse, HttpResponseServerError, HttpResponseBadRequest
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings

@csrf_exempt
@require_http_methods(["GET"])
def get_session_token(request):
    """
    این ویو یک توکن جلسه از OpenAI Realtime API دریافت کرده و آن را به کلاینت برمی‌گرداند.
    این ویو به عنوان یک پروکسی برای امن نگه داشتن کلید API عمل می‌کند.
    """
    openai_api_key = os.environ.get('OPENAI_API_KEY')
    if not openai_api_key:
        # در محیط جنگو، بهتر است از settings.OPENAI_API_KEY استفاده شود.
        # اما برای سادگی و سازگاری با محیط‌های مختلف، از متغیر محیطی می‌خوانیم.
        return HttpResponseServerError("کلید OPENAI_API_KEY تنظیم نشده است.")

    headers = {
        'Authorization': f'Bearer {openai_api_key}',
        'Content-Type': 'application/json',
    }

    # مدل استفاده شده در کد اصلی
    body = {
        "model": "gpt-4o-realtime-preview-2025-06-03",
    }

    try:
        response = requests.post(
            'https://api.openai.com/v1/realtime/sessions',
            headers=headers,
            json=body
        )
        response.raise_for_status()  # اگر پاسخ خطا بود، استثنا ایجاد می‌کند
        return JsonResponse(response.json())
    except requests.exceptions.RequestException as e:
        print(f"خطا در ارتباط با OpenAI API: {e}")
        return HttpResponseServerError("خطا در برقراری ارتباط با سرور OpenAI.")
    except Exception as e:
        print(f"یک خطای پیش‌بینی نشده رخ داد: {e}")
        return HttpResponseServerError("یک خطای داخلی در سرور رخ داد.")

@csrf_exempt
@require_http_methods(["POST"])
def get_chat_completion(request):
    """
    این ویو یک درخواست به OpenAI Chat Completions API ارسال می‌کند.
    توسط منطق ایجنت‌های پیچیده (مانند ناظر) برای دریافت پاسخ از مدل‌های قدرتمندتر استفاده می‌شود.
    """
    try:
        data = json.loads(request.body)
        model = data.get('model')
        messages = data.get('input') # In the original code, the key is 'input'

        if not model or not messages:
            return HttpResponseBadRequest("پارامترهای 'model' و 'input' الزامی هستند.")
    except json.JSONDecodeError:
        return HttpResponseBadRequest("بدنه درخواست نامعتبر است (باید JSON باشد).")

    openai_api_key = os.environ.get('OPENAI_API_KEY')
    if not openai_api_key:
        return HttpResponseServerError("کلید OPENAI_API_KEY تنظیم نشده است.")

    headers = {
        'Authorization': f'Bearer {openai_api_key}',
        'Content-Type': 'application/json',
    }

    body = {
        "model": model,
        "messages": messages,
    }

    try:
        response = requests.post(
            'https://api.openai.com/v1/chat/completions',
            headers=headers,
            json=body
        )
        response.raise_for_status()
        return JsonResponse(response.json())
    except requests.exceptions.RequestException as e:
        print(f"خطا در ارتباط با OpenAI API: {e}")
        return HttpResponseServerError("خطا در برقراری ارتباط با سرور OpenAI.")
    except Exception as e:
        print(f"یک خطای پیش‌بینی نشده رخ داد: {e}")
        return HttpResponseServerError("یک خطای داخلی در سرور رخ داد.")
