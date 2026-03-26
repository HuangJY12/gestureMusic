import os
from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit

app = Flask(__name__)

# 不显式指定 async_mode，让它在本地用 threading，在 Render 用 eventlet
socketio = SocketIO(app, cors_allowed_origins="*")

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('my_hand_data')
def handle_hand_data(hands):
    emit('update_skeletons', {
        'user_id': request.sid,
        'hands': hands
    }, broadcast=True)

if __name__ == '__main__':
    # 这里的代码仅在你本地运行 python app.py 时执行
    port = int(os.environ.get('PORT', 5000))
    socketio.run(app, host='0.0.0.0', port=port, debug=True)
