from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit

app = Flask(__name__)
# 允许跨域，这是手机访问的关键
socketio = SocketIO(app, cors_allowed_origins="*")

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('my_hand_data')
def handle_hand_data(hands):
    # 现在 request.sid 应该可以正常工作了
    user_id = request.sid
    
    # 广播给所有人
    emit('update_skeletons', {
        'user_id': user_id,
        'hands': hands
    }, broadcast=True)
# @socketio.on('nextPage')
# def handle_hand_data(hands):
#     return render_template('index.html')

if __name__ == '__main__':
    # 使用 ssl_context='adhoc' 开启临时 HTTPS，方便手机摄像头调用
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, ssl_context='adhoc')