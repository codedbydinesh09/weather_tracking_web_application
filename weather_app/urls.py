from django.urls import path
from . import views
from . import route_views

urlpatterns = [
    # ─── Auth ───────────────────────────────────────────────────────
    path('', views.login_view, name='login'),
    path('register/', views.register_view, name='register'),
    path('logout/', views.logout_view, name='logout'),

    # ─── Pages ──────────────────────────────────────────────────────
    path('dashboard/', views.dashboard, name='dashboard'),
    path('comparison/', views.comparison, name='comparison'),
    path('route-weather/', views.route_weather, name='route_weather'),
    path('chatbot/', views.chatbot, name='chatbot'),
    path('profile/', views.profile, name='profile'),

    # ─── API Endpoints ──────────────────────────────────────────────
    path('api/weather/', views.api_weather, name='api_weather'),
    path('api/weather-coords/', views.api_weather_coords, name='api_weather_coords'),
    path('api/chatbot/', views.api_chatbot, name='api_chatbot'),
    path('api/forecast/', views.api_forecast, name='api_forecast'),
    path('api/city-search/', views.api_city_search, name='api_city_search'),
    path('api/chat-sessions/', views.api_chat_sessions, name='api_chat_sessions'),
    path('api/chat-sessions/<int:session_id>/', views.api_chat_session_detail, name='api_chat_session_detail'),

    # ─── Route Weather API Endpoints ────────────────────────────────
    path('api/route/generate/', route_views.api_route_generate, name='api_route_generate'),
    path('api/route/city-search/', route_views.api_route_city_search, name='api_route_city_search'),
]