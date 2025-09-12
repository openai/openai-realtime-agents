from django.urls import path
from . import views

app_name = 'agente_farsi'

urlpatterns = [
    path('session/', views.get_session_token, name='get_session_token'),
    path('responses/', views.get_chat_completion, name='get_chat_completion'),
]
