import os
from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit

app = Flask(__name__)
# 生产环境下通常建议指定具体的域名，测试阶段保持 "*"
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='gevent')

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('my_hand_data')
def handle_hand_data(hands):
    user_id = request.sid
    # 广播给所有人
    emit('update_skeletons', {
        'user_id': user_id,
        'hands': hands
    }, broadcast=True)

if __name__ == '__main__':
    # 从环境变量读取端口，默认为 10000 (Render 默认端口)
    port = int(os.environ.get('PORT', 10000))
    # 生产环境不要开启 allow_unsafe_werkzeug，也不要传 ssl_context
    socketio.run(app, host='0.0.0.0', port=port)
