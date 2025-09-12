from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('agente_farsi.urls')),
    path('', TemplateView.as_view(template_name='agente_farsi/base.html'), name='home'),
]
