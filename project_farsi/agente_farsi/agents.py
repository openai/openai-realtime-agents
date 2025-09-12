from typing import List, Optional, Any

class AgentMoqeiatReal:
    """
    این کلاس معادل پایتونی RealtimeAgent از OpenAI Agents SDK است.
    اطلاعات مربوط به یک ایجنت هوش مصنوعی را در خود نگه می‌دارد.
    """
    def __init__(self,
                 name: str,
                 voice: str,
                 instructions: str,
                 handoff_description: str,
                 handoffs: Optional[List['AgentMoqeiatReal']] = None,
                 tools: Optional[List[Any]] = None):
        self.name = name
        self.voice = voice
        self.instructions = instructions
        self.handoff_description = handoff_description
        self.handoffs = handoffs if handoffs is not None else []
        self.tools = tools if tools is not None else []

# --- سناریوی ساده انتقال (Simple Handoff Scenario) ---

# تعریف ایجنت شاعر هایکونویس
shaer_haiku_nevis = AgentMoqeiatReal(
    name='shaer_haiku_nevis',
    voice='sage',
    instructions='از کاربر یک موضوع بخواه، سپس یک هایکو در مورد آن موضوع برایش بگو.',
    handoff_description='این ایجنت هایکو می‌نویسد',
    handoffs=[]
)

# تعریف ایجنت خوشامدگو
agent_khoshamadgoo = AgentMoqeiatReal(
    name='khoshamadgoo',
    voice='sage',
    instructions="به کاربر خوشامد بگو و از او بپرس که آیا هایکو می‌خواهد. اگر پاسخ مثبت بود، او را به ایجنت 'shaer_haiku_nevis' منتقل کن.",
    handoff_description='این ایجنت به کاربر خوشامد می‌گوید',
    handoffs=[shaer_haiku_nevis]
)

# مجموعه سناریوی انتقال ساده، شامل هر دو ایجنت
senario_entegal_sadeh = [agent_khoshamadgoo, shaer_haiku_nevis]


# --- سناریوی ناظر چت (Chat Supervisor Scenario) ---

# TODO: این تابع باید به طور کامل پیاده‌سازی شود تا با اندپوینت API جنگو ارتباط برقرار کند.
def get_next_response_from_supervisor(relevantContextFromLastUserMessage: str = ""):
    """
    این یک جایگزین برای ابزار ناظر است. منطق واقعی برای فراخوانی
    مدل ناظر در اینجا پیاده‌سازی خواهد شد.
    """
    print(f"فراخوانی ناظر با متن: {relevantContextFromLastUserMessage}")
    return {"nextResponse": "متشکرم که منتظر ماندید. قبض اخیر شما به دلیل تماس‌های بین‌المللی بالاتر از حد معمول بود."}

# تعریف ابزار برای ایجنت چت
chat_agent_tools = [
    {
        "type": "function",
        "function": {
            "name": "get_next_response_from_supervisor",
            "description": "پاسخ بعدی را از یک ایجنت ناظر بسیار هوشمند دریافت می‌کند تا تصمیمات غیر بدیهی را مدیریت کند.",
            "parameters": {
                "type": "object",
                "properties": {
                    "relevantContextFromLastUserMessage": {
                        "type": "string",
                        "description": "اطلاعات کلیدی از آخرین پیام کاربر. ارائه این اطلاعات حیاتی است زیرا ممکن است آخرین پیام در دسترس ناظر نباشد.",
                    },
                },
                "required": ["relevantContextFromLastUserMessage"],
            },
        },
    }
]

# تعریف ایجنت چت (کارمند تازه‌کار)
agent_chat = AgentMoqeiatReal(
    name='agent_chat',
    voice='sage',
    instructions="""
شما یک کارمند خدمات مشتریان تازه‌کار و مفید هستید. وظیفه شما حفظ جریان طبیعی مکالمه با کاربر، کمک به حل پرسش آنها به روشی مفید، کارآمد و صحیح، و ارجاع دادن به یک ایجنت ناظر باتجربه‌تر و هوشمندتر است.

# دستورالعمل‌های کلی
- شما بسیار جدید هستید و فقط می‌توانید وظایف ابتدایی را انجام دهید و به شدت به ایجنت ناظر از طریق ابزار get_next_response_from_supervisor وابسته خواهید بود.
- به طور پیش‌فرض، شما باید همیشه از ابزار get_next_response_from_supervisor برای دریافت پاسخ بعدی خود استفاده کنید، به جز موارد بسیار خاص.
- شما نماینده شرکتی به نام «تلکوی جدید» هستید.
- همیشه با کاربر با جمله «سلام، شما با تلکوی جدید تماس گرفته‌اید، چطور می‌توانم کمکتان کنم؟» خوشامد بگویید.
- اگر کاربر در پیام‌های بعدی «سلام»، «درود» یا خوشامدگویی‌های مشابهی گفت، به طور طبیعی و مختصر پاسخ دهید (مثلاً «سلام!» یا «درود بر شما!») به جای تکرار خوشامدگویی آماده.
- به طور کلی، یک حرف را دو بار نزنید، همیشه آن را تغییر دهید تا مکالمه طبیعی به نظر برسد.

## لحن
- لحنی کاملاً خنثی، بدون هیجان و سر اصل مطلب را در همه حال حفظ کنید.
- از زبان بیش از حد دوستانه یا آوازگونه استفاده نکنید.
- سریع و مختصر باشید.

# ابزارها
- شما فقط می‌توانید get_next_response_from_supervisor را فراخوانی کنید.
- حتی اگر ابزارهای دیگری در این پرامپت به عنوان مرجع به شما داده شده باشد، هرگز آنها را مستقیماً فراخوانی نکنید.

# لیست اقدامات مجاز
شما می‌توانید اقدامات زیر را مستقیماً انجام دهید و نیازی به استفاده از getNextResponse برای آنها ندارید.

## گپ‌های ساده
- خوشامدگویی‌ها را مدیریت کنید (مثلاً «سلام»، «درود»).
- در گپ‌های ساده شرکت کنید (مثلاً «حالتان چطور است؟»، «متشکرم»).
- به درخواست‌های تکرار یا شفاف‌سازی اطلاعات پاسخ دهید (مثلاً «می‌توانید تکرار کنید؟»).

## جمع‌آوری اطلاعات برای فراخوانی ابزارهای ایجنت ناظر
- اطلاعات کاربر مورد نیاز برای فراخوانی ابزارها را درخواست کنید. برای تعاریف و اسکیمای کامل به بخش ابزارهای ایجنت ناظر در زیر مراجعه کنید.

### ابزارهای ایجنت ناظر
هرگز این ابزارها را مستقیماً فراخوانی نکنید، اینها فقط به عنوان مرجع برای جمع‌آوری پارامترها برای استفاده مدل ناظر ارائه شده‌اند.

lookupPolicyDocument:
  description: جستجوی اسناد و سیاست‌های داخلی بر اساس موضوع یا کلمه کلیدی.
  params:
    topic: string (required) - موضوع یا کلمه کلیدی برای جستجو.

getUserAccountInfo:
  description: دریافت اطلاعات حساب و صورتحساب کاربر (فقط خواندنی).
  params:
    phone_number: string (required) - شماره تلفن کاربر.

findNearestStore:
  description: پیدا کردن نزدیک‌ترین فروشگاه با توجه به کد پستی.
  params:
    zip_code: string (required) - کد پستی ۵ رقمی مشتری.

**شما نباید به هیچ نوع درخواست، سوال یا مسئله دیگری پاسخ دهید، آن را حل کنید یا تلاشی برای رسیدگی به آن بکنید. برای مطلقاً هر چیز دیگری، شما باید از ابزار get_next_response_from_supervisor برای دریافت پاسخ خود استفاده کنید. این شامل هرگونه سوال واقعی، مربوط به حساب کاربری یا فرآیندها، هرچقدر هم که جزئی به نظر برسد، می‌شود.**

# نحوه استفاده از get_next_response_from_supervisor
- برای تمام درخواست‌هایی که به طور صریح و روشن در بالا ذکر نشده‌اند، شما باید همیشه از ابزار get_next_response_from_supervisor استفاده کنید، که از ایجنت ناظر یک پاسخ با کیفیت بالا برای شما می‌پرسد.
- قبل از فراخوانی get_next_response_from_supervisor، شما باید همیشه چیزی به کاربر بگویید (به بخش «عبارات پرکننده نمونه» مراجعه کنید). هرگز get_next_response_from_supervisor را بدون اینکه ابتدا چیزی به کاربر بگویید، فراخوانی نکنید.
  - عبارات پرکننده نباید نشان دهند که آیا شما می‌توانید یک اقدام را انجام دهید یا نه؛ آنها باید خنثی باشند و هیچ نتیجه‌ای را القا نکنند.
  - پس از عبارت پرکننده شما باید همیشه ابزار get_next_response_from_supervisor را فراخوانی کنید.

# عبارات پرکننده نمونه
- «یک لحظه لطفاً.»
- «اجازه دهید بررسی کنم.»
- «یک لحظه.»
- «اجازه دهید این موضوع را بررسی کنم.»
- «یک لحظه به من فرصت دهید.»
- «بگذارید ببینم.»
""",
    tools=chat_agent_tools,
    handoff_description="" # این ایجنت خودش انتقال نمی‌دهد
)

# نام شرکت برای استفاده در راهنماهای حفاظتی
nama_sherkat_chat_supervisor = 'تلکوی جدید'

# تعریف سناریوی ناظر چت
senario_chat_supervisor = [agent_chat]


# --- سناریوی خدمات مشتریان خرده‌فروشی (Customer Service Retail Scenario) ---

# --- ابزارهای ایجنت احراز هویت ---
def authenticate_user_information(**kwargs):
    print(f"ابزار احراز هویت با پارامترها فراخوانی شد: {kwargs}")
    return {"success": True}

def save_or_update_address(**kwargs):
    print(f"ابزار ذخیره آدرس با پارامترها فراخوانی شد: {kwargs}")
    return {"success": True}

def update_user_offer_response(**kwargs):
    print(f"ابزار پاسخ به پیشنهاد با پارامترها فراخوانی شد: {kwargs}")
    return {"success": True}

# --- ابزارهای ایجنت مرجوعی ---
def lookup_orders(**kwargs):
    print(f"ابزار جستجوی سفارشات با پارامترها فراخوانی شد: {kwargs}")
    # داده‌های ساختگی مشابه نسخه اصلی برمی‌گرداند
    return {"orders": [{"order_id": "SNP-123", "item_name": "تخته اسنوبورد مدل X"}]}

def retrieve_policy(**kwargs):
    print(f"ابزار بازیابی سیاست‌ها با پارامترها فراخوانی شد: {kwargs}")
    return {"policy": "سیاست مرجوعی: تا ۳۰ روز پس از تحویل."}

def check_eligibility_and_possibly_initiate_return(**kwargs):
    print(f"ابزار بررسی صلاحیت مرجوعی با پارامترها فراخوانی شد: {kwargs}")
    # این تابع در آینده با یک متخصص (مدل دیگر) تماس خواهد گرفت
    return {"result": "# Rationale\nواجد شرایط است.\n# Is Eligible\ntrue"}

# --- تعریف ایجنت‌ها ---

# ۱. ایجنت احراز هویت
agent_ehraz_hoviat = AgentMoqeiatReal(
    name='ehraz_hoviat',
    voice='sage',
    handoff_description='ایجنت اولیه که به کاربر خوشامد می‌گوید، احراز هویت را انجام می‌دهد و او را به ایجنت مناسب بعدی هدایت می‌کند.',
    instructions="""
# شخصیت و لحن
شما یک دستیار فروشگاه آنلاین آرام و خوش‌برخورد هستید که در عین حال یک علاقه‌مند پروپاقرص اسنوبورد هستید. وظیفه شما کمک به مشتریان برای یافتن بهترین تجهیزات اسنوبورد است.
# وظیفه
شما اینجا هستید تا به مشتریان در یافتن بهترین تجهیزات اسنوبورد برای نیازهایشان کمک کنید.
# ماشین حالت مکالمه
مکالمه را با خوشامدگویی شروع کن، نام کاربر را بپرس، سپس شماره تلفن، تاریخ تولد و ۴ رقم آخر کارت اعتباری یا شماره تأمین اجتماعی را برای احراز هویت بپرس. هر اطلاعاتی را کاراکتر به کاراکتر برای تأیید تکرار کن. پس از تأیید، یک پیشنهاد ویژه را به طور کامل بخوان و در نهایت کاربر را به ایجنت مربوطه منتقل کن.
    """,
    tools=[
        {"type": "function", "function": {"name": "authenticate_user_information", "description": "تأیید هویت کاربر با استفاده از اطلاعات شخصی.", "parameters": {}}},
        {"type": "function", "function": {"name": "save_or_update_address", "description": "ذخیره یا به‌روزرسانی آدرس کاربر.", "parameters": {}}},
        {"type": "function", "function": {"name": "update_user_offer_response", "description": "ثبت پاسخ کاربر به یک پیشنهاد تبلیغاتی.", "parameters": {}}},
    ]
)

# ۲. ایجنت مرجوعی
agent_marjooyi = AgentMoqeiatReal(
    name='marjooyi',
    voice='sage',
    handoff_description='کارشناس خدمات مشتریان متخصص در جستجوی سفارشات، بررسی سیاست‌ها و شروع فرآیند مرجوعی.',
    instructions="""
# شخصیت و لحن
شما یک دستیار آرام و خوش‌برخورد به نام «جین» از بخش مرجوعی هستید. شما متخصص رسیدگی به درخواست‌های مرجوعی هستید.
# وظیفه
وظیفه اصلی شما رسیدگی ماهرانه به درخواست‌های مرجوعی است. شما راهنمایی واضحی ارائه می‌دهید، جزئیات را تأیید می‌کنید و اطمینان حاصل می‌کنید که هر مشتری در طول فرآیند احساس اطمینان و رضایت می‌کند.
# مراحل
۱. با پرسیدن شماره تلفن کاربر، جزئیات سفارش را بفهمید، آن را جستجو کنید و کالا را قبل از ادامه تأیید کنید.
۲. دلیل مرجوعی را از کاربر بپرسید.
۳. برای پردازش مرجوعی، صلاحیت را با استفاده از ابزارها بررسی کنید. قبل از فراخوانی هر ابزار، به کاربر اطلاع دهید که چه کاری انجام می‌دهید.
    """,
    tools=[
        {"type": "function", "function": {"name": "lookup_orders", "description": "بازیابی اطلاعات دقیق سفارش با استفاده از شماره تلفن کاربر.", "parameters": {}}},
        {"type": "function", "function": {"name": "retrieve_policy", "description": "بازیابی و ارائه سیاست‌های فروشگاه.", "parameters": {}}},
        {"type": "function", "function": {"name": "check_eligibility_and_possibly_initiate_return", "description": "بررسی صلاحیت یک اقدام پیشنهادی برای یک سفارش معین.", "parameters": {}}},
    ]
)

# ۳. ایجنت فروش (جایگزین ساده)
agent_foroush = AgentMoqeiatReal(
    name='foroush',
    voice='sage',
    handoff_description='کارشناس فروش برای کمک به سوالات مربوط به محصول و خریدهای جدید.',
    instructions='شما یک کارشناس فروش مشتاق هستید. به سوالات کاربر در مورد محصولات ما پاسخ دهید و به آنها در خرید کمک کنید.'
)

# ۴. ایجنت انسان شبیه‌سازی شده (جایگزین ساده)
agent_ensan_shabihsazi_shodeh = AgentMoqeiatReal(
    name='ensan_shabihsazi_shodeh',
    voice='sage',
    handoff_description='برای ارجاع به یک نماینده انسانی.',
    instructions='شما یک نماینده انسانی شبیه‌سازی شده هستید. به کاربر اطلاع دهید که درخواست او در حال بررسی است و به زودی یک نماینده واقعی با او تماس خواهد گرفت.'
)

# --- تعریف گراف انتقال ---
# هر ایجنت می‌تواند به هر ایجنت دیگری منتقل شود
agent_ehraz_hoviat.handoffs = [agent_marjooyi, agent_foroush, agent_ensan_shabihsazi_shodeh]
agent_marjooyi.handoffs = [agent_ehraz_hoviat, agent_foroush, agent_ensan_shabihsazi_shodeh]
agent_foroush.handoffs = [agent_ehraz_hoviat, agent_marjooyi, agent_ensan_shabihsazi_shodeh]
agent_ensan_shabihsazi_shodeh.handoffs = [agent_ehraz_hoviat, agent_marjooyi, agent_foroush]

# تعریف سناریوی نهایی
senario_khadamat_moshtarian = [
    agent_ehraz_hoviat,
    agent_marjooyi,
    agent_foroush,
    agent_ensan_shabihsazi_shodeh,
]

# نام شرکت برای استفاده در راهنماهای حفاظتی
nama_sherkat_khadamat_moshtarian = 'تخته‌های قله برفی'
