let socket = null;
let connectionAttempts = 0;
const MAX_RETRY_ATTEMPTS = 3;

const currentUser = {
  id: '',
  username: '',
  avatar: '',
  isAdmin: false,
  isPremium: false,
  isModerator: false
};

let typing = false;
let typingTimeout;

let typingUsers = new Set();

let activeMessageMenu = null;
let editingMessageId = null;
let replyingToMessageId = null;

const ADMIN_USERNAMES = ['yogurtabc', 'yurii_fisting', 'lovely', 'Йогурт', 'Yogurt', 'Kiequra'];
const ADMIN_PASSWORD = 'cul6768adm';
const MODERATOR_PASSWORD = 'cul7686mod';
let customTooltip = null;

const CATEGORY_LABELS = {
  Animals: "Животные",
  Premium: "Премиум",
  Stuff: "Стафф",
  Moderator: "Модерация"
};

function showCustomTooltip(e, text) {
  if (!customTooltip) {
    customTooltip = document.createElement('div');
    customTooltip.className = 'custom-tooltip';
    document.body.appendChild(customTooltip);
  }
  const targetRect = e.target.getBoundingClientRect();
  customTooltip.textContent = text;
  customTooltip.style.left = `${targetRect.left + targetRect.width / 2}px`;
  customTooltip.style.top = `${targetRect.top}px`;
  customTooltip.style.transform = 'translate(-50%, -110%)';
  customTooltip.classList.add('visible');
}

function hideCustomTooltip() {
  if (customTooltip) {
    customTooltip.classList.remove('visible');
  }
}

function addAdminBadge(parentElement) {
  const adminBadge = document.createElement('img');
  adminBadge.src = 'public/Images/verified.png';
  adminBadge.className = 'admin-badge';
  parentElement.appendChild(adminBadge);

  adminBadge.addEventListener('mouseenter', (e) => showCustomTooltip(e, 'Администратор'));
  adminBadge.addEventListener('mouseleave', hideCustomTooltip);
}

function addModeratorBadge(parentElement) {
  const moderatorBadge = document.createElement('img');
  moderatorBadge.src = 'public/Images/moderator.png';
  moderatorBadge.className = 'moderator-badge';
  moderatorBadge.style.width = '16px';
  moderatorBadge.style.height = '16px';
  moderatorBadge.style.marginLeft = '6px';
  moderatorBadge.style.verticalAlign = 'text-bottom';
  parentElement.appendChild(moderatorBadge);
  moderatorBadge.addEventListener('mouseenter', (e) => showCustomTooltip(e, 'Модератор'));
  moderatorBadge.addEventListener('mouseleave', hideCustomTooltip);
}

function addPremiumBadge(parentElement) {
  const premiumBadge = document.createElement('img');
  premiumBadge.src = 'public/Images/premium.png';
  premiumBadge.className = 'premium-badge';
  premiumBadge.style.width = '16px';
  premiumBadge.style.height = '16px';
  premiumBadge.style.marginLeft = '6px';
  premiumBadge.style.verticalAlign = 'text-bottom';
  premiumBadge.style.filter = 'drop-shadow(0 0 4px rgba(255, 215, 0, 0.6))';
  parentElement.appendChild(premiumBadge);

  premiumBadge.addEventListener('mouseenter', (e) => showCustomTooltip(e, 'Премиум-пользователь'));
  premiumBadge.addEventListener('mouseleave', hideCustomTooltip);
}

function createMessageElement(message, isMyMessage, isNewMessage = true) {
  const messageWrapper = document.createElement('div');
  
  if (isNewMessage) {
    messageWrapper.className = `messageWrapper ${isMyMessage ? 'myMessage' : ''}`;
  } else {
    messageWrapper.className = `messageWrapper ${isMyMessage ? 'myMessage' : ''} no-animation`;
  }
  
  messageWrapper.dataset.messageId = message.id;
  messageWrapper.dataset.userId = message.user.id;
  messageWrapper.dataset.username = message.user.username;
  
  const messageContent = document.createElement('div');
  messageContent.className = 'messageContent';
  
  const messageSender = document.createElement('div');
  messageSender.className = 'messageSender';
  messageSender.textContent = isMyMessage ? '' : message.user.username;
  
  if (!isMyMessage) {
    if (message.user.isAdmin) {
      addAdminBadge(messageSender);
    } else if (message.user.isModerator) {
      addModeratorBadge(messageSender);
    } else if (message.user.isPremium) {
      addPremiumBadge(messageSender);
    }
  }
  
  messageContent.appendChild(messageSender);
  
  if (message.replyTo) {
    const replyBlock = document.createElement('div');
    replyBlock.className = 'messageReply';
    
    const replyAuthor = document.createElement('div');
    replyAuthor.className = 'replyAuthor';
    replyAuthor.textContent = message.replyTo.username;
    
    const replyText = document.createElement('div');
    replyText.className = 'replyText';
    replyText.textContent = message.replyTo.text;
    
    replyBlock.appendChild(replyAuthor);
    replyBlock.appendChild(replyText);
    
    replyBlock.addEventListener('click', function(e) {
      e.stopPropagation();
      scrollToMessage(message.replyTo.id);
    });
    
    messageContent.appendChild(replyBlock);
  }
  
  const messageText = document.createElement('div');
  messageText.className = 'messageText';
  messageText.textContent = message.text;
  messageContent.appendChild(messageText);
  
  const messageTime = document.createElement('div');
  messageTime.className = 'messageTime';
  messageTime.textContent = formatTime(message.time);
  if (message.edited) {
    messageTime.textContent += ' (изменено)';
  }
  messageContent.appendChild(messageTime);
  
  messageWrapper.appendChild(messageContent);
  
  if (!isMyMessage) {
    const avatar = document.createElement('img');
    avatar.src = 'public/' + message.user.avatar;
    avatar.className = 'userAvatar';
    avatar.alt = message.user.username;
    messageWrapper.prepend(avatar);
  }
  
  messageContent.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (editingMessageId === message.id) {
      return;
    }
    
    const menuX = e.clientX;
    const menuY = e.clientY;
    
    showMessageMenu(message.id, menuX, menuY);
  });
  
  return messageWrapper;
}

function showMessageMenu(messageId, x, y) {
  closeMessageMenu();

  const messageWrapper = document.querySelector(`.messageWrapper[data-message-id="${messageId}"]`);
  const isMyMessage = messageWrapper && (messageWrapper.classList.contains('myMessage') || messageWrapper.dataset.userId === currentUser.id || messageWrapper.dataset.username.toLowerCase() === currentUser.username.toLowerCase());

  const menu = document.createElement('div');
  menu.className = 'message-context-menu';
  let menuHtml = `<div class="menu-item reply-message">Ответить</div>`;
  if (isMyMessage) {
    menuHtml += `<div class="menu-item edit-message">Редактировать</div>`;
    menuHtml += `<div class="menu-item delete-message">Удалить</div>`;
  }
  menu.innerHTML = menuHtml;

  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    menu.classList.add('mobile');
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.transform = 'translate(-50%, -100%)';
    
    setTimeout(() => {
      const menuRect = menu.getBoundingClientRect();
      
      if (menuRect.left < 10) {
        menu.style.left = '10px';
        menu.style.transform = 'translateY(-100%)';
      }
      
      if (menuRect.right > window.innerWidth - 10) {
        menu.style.left = `${window.innerWidth - 10}px`;
        menu.style.transform = 'translate(-100%, -100%)';
      }
      
      if (menuRect.top < 10) {
        menu.style.top = `${y + 20}px`;
        menu.style.transform = menu.style.transform.includes('translateX') ? 
          menu.style.transform.replace('translateY(-100%)', 'translateY(0)') :
          menu.style.transform.replace('translate(-50%, -100%)', 'translate(-50%, 0)').replace('translate(-100%, -100%)', 'translate(-100%, 0)');
      }
      
      if (menuRect.bottom > window.innerHeight - 10) {
        menu.style.top = `${y - 20}px`;
        menu.style.transform = menu.style.transform.includes('translateX') ? 
          menu.style.transform.replace('translateY(0)', 'translateY(-100%)') :
          menu.style.transform.replace('translate(-50%, 0)', 'translate(-50%, -100%)').replace('translate(-100%, 0)', 'translate(-100%, -100%)');
      }
    }, 0);
  } else {
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    setTimeout(() => {
      const menuRect = menu.getBoundingClientRect();
      if (menuRect.right > window.innerWidth) {
        menu.style.left = `${window.innerWidth - menuRect.width - 10}px`;
      }
      if (menuRect.bottom > window.innerHeight) {
        menu.style.top = `${window.innerHeight - menuRect.height - 10}px`;
      }
    }, 0);
  }

  document.body.appendChild(menu);
  activeMessageMenu = { menu, messageId };

  menu.addEventListener('click', function(e) {
    e.stopPropagation();
  });

  menu.querySelector('.reply-message').addEventListener('click', function(e) {
    e.stopPropagation();
    startReplyToMessage(messageId);
    closeMessageMenu();
  });
  if (isMyMessage) {
    menu.querySelector('.edit-message').addEventListener('click', function(e) {
      e.stopPropagation();
      startEditingMessage(messageId);
      closeMessageMenu();
    });
    menu.querySelector('.delete-message').addEventListener('click', function(e) {
      e.stopPropagation();
      confirmDeleteMessage(messageId);
      closeMessageMenu();
    });
  }

  const escHandler = function(e) {
    if (e.key === 'Escape') {
      closeMessageMenu();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
  setTimeout(() => {
    document.addEventListener('click', closeMessageMenu);
  }, 10);
}

function closeMessageMenu() {
  if (activeMessageMenu && activeMessageMenu.menu) {
    if (document.body.contains(activeMessageMenu.menu)) {
      activeMessageMenu.menu.remove();
    }
    document.removeEventListener('click', closeMessageMenu);
    document.removeEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeMessageMenu();
    });
    activeMessageMenu = null;
  }
}

function startEditingMessage(messageId) {
  const messageWrapper = document.querySelector(`.messageWrapper[data-message-id="${messageId}"]`);
  if (!messageWrapper) return;
  
  const messageTextElement = messageWrapper.querySelector('.messageText');
  if (!messageTextElement) return;
  
  const originalText = messageTextElement.textContent;
  
  messageWrapper.classList.add('editing');
  
  const sendButton = document.getElementById('send-button');
  sendButton.classList.add('editing');
  
  const messageInput = document.getElementById('message-input');
  const currentInputText = messageInput.value;
  
  const previousState = {
    text: currentInputText,
    placeholder: messageInput.placeholder
  };
  
  messageInput.value = originalText;
  messageInput.placeholder = 'Редактирование сообщения...';
  messageInput.focus();
  messageInput.setSelectionRange(messageInput.value.length, messageInput.value.length);
  
  editingMessageId = messageId;
  
  const keyHandler = function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const newText = messageInput.value.trim();
      if (newText && newText !== originalText) {
        if (socket) {
          socket.emit('editMessage', {
            id: messageId,
            text: newText
          });
        }
        
        messageInput.value = '';
        messageInput.placeholder = previousState.placeholder;
        
        messageWrapper.classList.remove('editing');
        
        document.getElementById('send-button').classList.remove('editing');
        
        editingMessageId = null;
        
        closeMessageMenu();
        messageInput.removeEventListener('keydown', keyHandler);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      messageInput.value = previousState.text;
      messageInput.placeholder = previousState.placeholder;
      
      messageWrapper.classList.remove('editing');
      
      document.getElementById('send-button').classList.remove('editing');
      
      editingMessageId = null;
      
      closeMessageMenu();
      messageInput.removeEventListener('keydown', keyHandler);
    }
  };
  
  messageInput.addEventListener('keydown', keyHandler);
}

function confirmDeleteMessage(messageId) {
  showConfirmModal(
    "Удалить сообщение",
    "Вы уверены, что хотите удалить это сообщение?",
    true,
    () => {
      if (socket) {
        socket.emit('deleteMessage', { id: messageId });
      }
    }
  );
}

function updateMessageText(messageId, newText, isEdited) {
  const messageWrapper = document.querySelector(`.messageWrapper[data-message-id="${messageId}"]`);
  if (!messageWrapper) return;
  
  const messageTextElement = messageWrapper.querySelector('.messageText');
  const messageTimeElement = messageWrapper.querySelector('.messageTime');
  
  if (messageTextElement) {
    messageTextElement.textContent = newText;
  }
  
  if (messageTimeElement && isEdited) {
    if (!messageTimeElement.textContent.includes('(изменено)')) {
      messageTimeElement.textContent += ' (изменено)';
    }
  }
}

function removeMessage(messageId) {
  const messageWrapper = document.querySelector(`.messageWrapper[data-message-id="${messageId}"]`);
  if (messageWrapper) {
    messageWrapper.classList.add('removing');
    setTimeout(() => {
      messageWrapper.remove();
    }, 300);
  }
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function addUserToList(user, isNewUser = true) {
  const usersList = document.querySelector('.usersList');
  
  const existingUser = document.getElementById(`user-${user.id}`);
  
  if (existingUser) {
    const avatarElement = existingUser.querySelector('.userAvatar');
    if (avatarElement) {
      avatarElement.src = 'public/' + user.avatar;
    }
    return;
  }
  
  const userItem = document.createElement('div');
  
  if (isNewUser) {
    userItem.className = 'userItem';
  } else {
    userItem.className = 'userItem no-animation';
  }
  
  userItem.id = `user-${user.id}`;
  
  if (user.id === currentUser.id) {
    userItem.classList.add('current-user');
  }
  
  const avatar = document.createElement('img');
  avatar.src = 'public/' + user.avatar;
  avatar.className = 'userAvatar online';
  avatar.alt = user.username;
  
  const userName = document.createElement('div');
  userName.className = 'userName';
  userName.textContent = user.username;
  
  if (user.isAdmin) {
    addAdminBadge(userName);
  } else if (user.isModerator) {
    addModeratorBadge(userName);
  } else if (user.isPremium) {
    addPremiumBadge(userName);
  }
  
  userItem.appendChild(avatar);
  userItem.appendChild(userName);
  
  if (user.id === currentUser.id) {
    const existingSeparator = document.querySelector('.users-separator');
    if (!existingSeparator) {
      const separator = document.createElement('div');
      separator.className = 'users-separator';
      
      if (usersList.firstChild) {
        usersList.insertBefore(separator, usersList.firstChild);
        usersList.insertBefore(userItem, usersList.firstChild);
      } else {
        usersList.appendChild(userItem);
        usersList.appendChild(separator);
      }
    } else {
      usersList.insertBefore(userItem, usersList.firstChild);
    }
  } else {
    const separator = document.querySelector('.users-separator');
    if (separator) {
      separator.parentNode.insertBefore(userItem, separator.nextSibling);
    } else {
      usersList.appendChild(userItem);
    }
  }
}

function removeUser(userId) {
  const userElement = document.getElementById(`user-${userId}`);
  if (userElement) {
    userElement.remove();
  }
}

function createNotificationToast(message) {
  if (document.getElementById('login-form') && document.getElementById('login-form').style.display !== 'none') {
    return;
  }
  if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
      .notification-toast {
        position: fixed;
        top: 20px;
        right: 20px;
        max-width: 300px;
        background-color: var(--card-background);
        border-left: 3px solid var(--accent-color);
        padding: 12px 15px;
        border-radius: 6px;
        box-shadow: 0 3px 10px rgba(0,0,0,0.3);
        z-index: 1000;
        color: var(--text-color);
        opacity: 0.9;
        transition: opacity 0.3s ease;
      }
      .notification-toast.mobile {
        right: auto;
        left: 50%;
        transform: translateX(-50%);
      }
    `;
    document.head.appendChild(style);
  }

  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.position = 'fixed';
    toastContainer.style.zIndex = '1000';
    toastContainer.style.top = '20px';
    toastContainer.style.right = '20px';
    document.body.appendChild(toastContainer);
  }

  const existingToasts = document.querySelectorAll('.notification-toast');
  existingToasts.forEach(t => {
    if (t.textContent === message) t.remove();
  });

  const toast = document.createElement('div');
  toast.className = 'notification-toast';
  toast.textContent = message;

  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    toast.classList.add('mobile');
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
  } else {
    const countToasts = document.querySelectorAll('.notification-toast:not(.mobile)').length;
    toast.style.position = 'fixed';
    toast.style.top = `${20 + countToasts * 70}px`;
    toast.style.right = '20px';
  }

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);

  return toast;
}

function createUserActivityToast(message, avatarUrl) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'notification-toast user-activity';

    const avatar = document.createElement('img');
    avatar.src = 'public/' + avatarUrl;
    avatar.className = 'toast-avatar';
    avatar.onerror = function() {
      this.src = 'public/Images/user.png';
      console.error('Не удалось загрузить аватар:', avatarUrl);
    };
    toast.appendChild(avatar);

    const text = document.createElement('span');
    text.textContent = message;
    toast.appendChild(text);

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function sendMessage() {
  if (!socket) return;
  
  const messageInput = document.getElementById('message-input');
  const message = messageInput.value.trim();
  
  if (message) {
    if (editingMessageId) {
      const messageWrapper = document.querySelector(`.messageWrapper[data-message-id="${editingMessageId}"]`);
      const originalText = messageWrapper.querySelector('.messageText').textContent;
      const newText = messageInput.value.trim();

      if (newText && newText !== originalText) {
        socket.emit('editMessage', { id: editingMessageId, text: newText });
      }

      messageWrapper.classList.remove('editing');
      document.getElementById('send-button').classList.remove('editing');
      messageInput.value = '';
      messageInput.placeholder = 'Введите сообщение...';
      editingMessageId = null;
      return;
    }
    
    const messageData = { text: message };
    
    if (replyingToMessageId) {
      const replyToMessage = document.querySelector(`.messageWrapper[data-message-id="${replyingToMessageId}"]`);
      if (replyToMessage) {
        const replyText = replyToMessage.querySelector('.messageText').textContent;
        const replyUsername = replyToMessage.querySelector('.messageSender').textContent || currentUser.username;
        
        messageData.replyTo = {
          id: replyingToMessageId,
          text: replyText,
          username: replyUsername
        };
      }
    }
    
    socket.emit('chatMessage', messageData);
    messageInput.value = '';
    messageInput.placeholder = 'Введите сообщение...';
    messageInput.focus();
    
    if (replyingToMessageId) {
      cancelReply();
    }
    
    socket.emit('stopTyping');
    typing = false;
    typingUsers.delete(currentUser.id);
    updateTypingIndicator();
    clearTimeout(typingTimeout);
  }
}

function handleTyping() {
  if (!socket) return;
  
  if (!typing) {
    typing = true;
    typingUsers.add(currentUser.id);
    socket.emit('typing');
  }
  
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('stopTyping');
    typing = false;
    typingUsers.delete(currentUser.id);
    updateTypingIndicator();
  }, 2000);
}

function initChat(userData) {
  try {
    if (!userData || !userData.user) {
      console.error('Invalid userData received:', userData);
      showConfirmModal("Ошибка входа", "Получены некорректные данные от сервера", false);
      return;
    }
    
    if (document.getElementById('login-form').style.display === 'none') {
      console.log('Чат уже инициализирован, обновляем данные');
      
      currentUser.id = userData.user.id;
      currentUser.username = userData.user.username;
      currentUser.avatar = userData.user.avatar;
      currentUser.isAdmin = userData.user.isAdmin;
      currentUser.isPremium = userData.user.isPremium;
      currentUser.isModerator = userData.user.isModerator;
      
      document.getElementById('current-user-avatar').src = 'public/' + userData.user.avatar;
      const userNameElement = document.getElementById('current-user-name');
      userNameElement.textContent = userData.user.username;
      
      userNameElement.querySelectorAll('.admin-badge, .premium-badge').forEach(badge => badge.remove());
      
      if (userData.user.isAdmin) {
        addAdminBadge(userNameElement);
      } else if (userData.user.isModerator) {
        addModeratorBadge(userNameElement);
      } else if (userData.user.isPremium) {
        addPremiumBadge(userNameElement);
      }
      
      if (Array.isArray(userData.users)) {
        document.querySelector('.usersList').innerHTML = '';
        userData.users.forEach(user => {
          addUserToList(user, false);
        });
      }
      
      document.getElementById('current-user-avatar').addEventListener('click', showAvatarSelector);
      
      return;
    }
    
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('chat-container').style.display = 'flex';

    currentUser.id = userData.user.id;
    currentUser.username = userData.user.username;
    currentUser.avatar = userData.user.avatar;
    currentUser.isAdmin = userData.user.isAdmin;
    currentUser.isPremium = userData.user.isPremium;
    currentUser.isModerator = userData.user.isModerator;
    
    document.getElementById('current-user-avatar').src = 'public/' + userData.user.avatar;
    const userNameElement = document.getElementById('current-user-name');
    userNameElement.textContent = userData.user.username;
    
    userNameElement.querySelectorAll('.admin-badge, .premium-badge').forEach(badge => badge.remove());
    
    if (userData.user.isAdmin) {
      addAdminBadge(userNameElement);
    } else if (userData.user.isModerator) {
      addModeratorBadge(userNameElement);
    } else if (userData.user.isPremium) {
      addPremiumBadge(userNameElement);
    }
    
    document.getElementById('group-name').textContent = userData.groupName;
    document.querySelector('.usersList').innerHTML = '';
    
    if (Array.isArray(userData.users)) {
      userData.users.forEach(user => {
        addUserToList(user, false);
      });
    } else {
      console.warn('Users list is not an array:', userData.users);
    }
    
    const messagesContainer = document.querySelector('.messagesContainer');
    messagesContainer.innerHTML = '';
    
    if (Array.isArray(userData.messages)) {
      userData.messages.forEach(message => {
        const isMyMessage = message.user.id === currentUser.id || message.user.username.toLowerCase() === currentUser.username.toLowerCase();
        const messageElement = createMessageElement(message, isMyMessage, false);
        messagesContainer.appendChild(messageElement);
      });
    } else {
      console.warn('Messages list is not an array:', userData.messages);
    }
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    document.getElementById('message-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    
    document.getElementById('message-input').addEventListener('input', () => {
      handleTyping();
    });
    
    document.getElementById('send-button').addEventListener('click', sendMessage);
    
    document.getElementById('group-name').addEventListener('click', (e) => {
      if (!currentUser.isAdmin) {
        showConfirmModal('Ошибка доступа', 'Только администраторы могут изменять название группы.', false);
        return;
      }
      
      const groupNameElement = e.target;
      if (groupNameElement.isContentEditable) return;

      const originalName = groupNameElement.textContent;
      groupNameElement.contentEditable = true;
      groupNameElement.classList.add('editing');
      groupNameElement.focus();
      document.execCommand('selectAll', false, null);

      const finishEditing = (save) => {
        groupNameElement.contentEditable = false;
        groupNameElement.classList.remove('editing');
        const newName = groupNameElement.textContent.trim();
        
        if (save && newName && newName !== originalName) {
          socket.emit('updateGroupName', newName);
        } else {
          groupNameElement.textContent = originalName;
        }

        groupNameElement.removeEventListener('blur', onBlur);
        groupNameElement.removeEventListener('keydown', onKeydown);
      };

      const onBlur = () => finishEditing(true);
      const onKeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          finishEditing(true);
        } else if (e.key === 'Escape') {
          finishEditing(false);
        }
      };

      groupNameElement.addEventListener('blur', onBlur);
      groupNameElement.addEventListener('keydown', onKeydown);
    });
    
    document.getElementById('current-user-avatar').addEventListener('click', showAvatarSelector);
    
    console.log('Chat initialized successfully');
  } catch (error) {
    console.error('Error initializing chat:', error);
    showConfirmModal("Ошибка инициализации", "Произошла ошибка при инициализации чата", false);
  }
}

function setupChatEvents() {
  if (!socket) return;

  socket.off('error');
  socket.off('connect_error');
  socket.off('disconnect');
  socket.off('welcome');
  socket.off('message');
  socket.off('messageEdited');
  socket.off('messageDeleted');
  socket.off('groupNameUpdated');
  socket.off('avatarChanged');
  socket.off('userJoined');
  socket.off('userLeft');
  socket.off('userTyping');
  socket.off('userStoppedTyping');

  socket.on('error', (error) => {
    console.error('Socket error:', error);
    showConfirmModal("Ошибка соединения", "Произошла ошибка при работе с сервером", false);
  });
  
  socket.on('connect_error', (error) => {
    console.error('Connection error in chat:', error);
  });
  
  socket.on('disconnect', (reason) => {
    console.log('Disconnected from server:', reason);
    if (reason === 'io server disconnect') {
      showConfirmModal("Соединение разорвано", "Сервер разорвал соединение. Возможно, вы были отключены администратором.", false);
    } else if (reason === 'transport close') {
      showConfirmModal("Соединение потеряно", "Потеряно соединение с сервером. Проверьте интернет-соединение.", false);
    }
  });
  
  socket.on('welcome', (userData) => {
    console.log('Received welcome event with data:', userData);
    
    if (!userData || !userData.user || !userData.user.id) {
      console.error('Invalid welcome data received:', userData);
      showConfirmModal(
        "Ошибка входа", 
        "Получены некорректные данные от сервера при входе. Попробуйте перезагрузить страницу.", 
        false
      );
      return;
    }
    
  });
  
  socket.on('message', (message) => {
    const messagesContainer = document.querySelector('.messagesContainer');
    const isMyMsg = message.user.id === currentUser.id || message.user.username.toLowerCase() === currentUser.username.toLowerCase();
    const messageElement = createMessageElement(message, isMyMsg);
    messagesContainer.appendChild(messageElement);
    
    updateTypingIndicator();
    
    setTimeout(() => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 50);
  });
  
  socket.on('messageEdited', (message) => {
    updateMessageText(message.id, message.text, true);
  });
  
  socket.on('messageDeleted', (data) => {
    removeMessage(data.id);
  });
  
  socket.on('groupNameUpdated', (data) => {
    document.getElementById('group-name').textContent = data.name;
    createNotificationToast(`Название группы изменено на "${data.name}"`);
  });
  
  socket.on('avatarChanged', (data) => {
    console.log('Получено событие avatarChanged:', data);
    
    const userElement = document.querySelector(`.userItem[id="user-${data.userId}"]`);
    if (userElement) {
      const avatarElement = userElement.querySelector('.userAvatar');
      if (avatarElement) {
        avatarElement.classList.add('avatar-fade-out');
        setTimeout(() => {
          avatarElement.src = 'public/' + data.newAvatar;
          avatarElement.classList.remove('avatar-fade-out');
          avatarElement.classList.add('avatar-fade-in');
          setTimeout(() => {
            avatarElement.classList.remove('avatar-fade-in');
          }, 300);
        }, 300);
      }
    }
    
    const messageAvatars = document.querySelectorAll(`.messageWrapper .userAvatar[alt="${data.username}"]`);
    messageAvatars.forEach(avatar => {
      avatar.classList.add('avatar-fade-out');
      setTimeout(() => {
        avatar.src = 'public/' + data.newAvatar;
        avatar.classList.remove('avatar-fade-out');
        avatar.classList.add('avatar-fade-in');
        setTimeout(() => {
          avatar.classList.remove('avatar-fade-in');
        }, 300);
      }, 300);
    });
    
    if (data.userId === currentUser.id || data.username.toLowerCase() === currentUser.username.toLowerCase()) {
      document.getElementById('current-user-avatar').src = 'public/' + data.newAvatar;
      currentUser.avatar = data.newAvatar;
    }
  });
  
  socket.on('userJoined', (user) => {
    const existingUser = document.getElementById(`user-${user.id}`);
    if (existingUser) {
      const avatarElement = existingUser.querySelector('.userAvatar');
      if (avatarElement) {
        avatarElement.src = 'public/' + user.avatar;
      }
      
      const messages = document.querySelectorAll(`.messageWrapper:not(.myMessage) .userAvatar[alt="${user.username}"]`);
      messages.forEach(avatar => {
        avatar.src = 'public/' + user.avatar;
      });
      
      if (user.id === currentUser.id) {
        document.getElementById('current-user-avatar').src = 'public/' + user.avatar;
        currentUser.avatar = user.avatar;
      }
      
      createUserActivityToast(`${user.username} вернулся(ась) в чат`, user.avatar);
    } else {
      addUserToList(user);
      createUserActivityToast(`${user.username} присоединился(ась) к чату`, user.avatar);
    }
  });
  
  socket.on('userLeft', (user) => {
    removeUser(user.id);
    createUserActivityToast(`${user.username} покинул(а) чат`, user.avatar);
    
    typingUsers.delete(user.id);
    updateTypingIndicator();
  });
  
  socket.on('userTyping', (user) => {
    if (user.id !== currentUser.id) {
      typingUsers.add(user.id);
      updateTypingIndicator();
    }
  });
  
  socket.on('userStoppedTyping', (user) => {
    typingUsers.delete(user.id);
    updateTypingIndicator();
  });
  
  const currentUserAvatar = document.getElementById('current-user-avatar');
  if (currentUserAvatar) {
    currentUserAvatar.style.cursor = 'pointer';
    currentUserAvatar.title = 'Нажмите, чтобы изменить аватарку';
    
    currentUserAvatar.addEventListener('click', showAvatarSelector);
  }
}

function updateTypingIndicator() {
  const typingIndicator = document.getElementById('typing-indicator');
  const replyIndicator = document.querySelector('.replyIndicator');
  const inputArea = document.querySelector('.inputArea');

  if (typingIndicator && typingIndicator.parentNode) {
    typingIndicator.parentNode.removeChild(typingIndicator);
  }

  if (replyIndicator && inputArea && replyIndicator.nextSibling !== inputArea) {
    inputArea.parentNode.insertBefore(replyIndicator, inputArea);
  }

  if (replyIndicator && replyIndicator.parentNode) {
    replyIndicator.parentNode.insertBefore(typingIndicator, replyIndicator.nextSibling);
  } else if (inputArea && inputArea.parentNode) {
    inputArea.parentNode.insertBefore(typingIndicator, inputArea);
  }

  let typingUserIds = Array.from(typingUsers);
  if (typing && !typingUserIds.includes(currentUser.id)) {
    typingUserIds.unshift(currentUser.id);
  }
  const typingUserNames = typingUserIds
    .map(userId => {
      if (userId === currentUser.id) return currentUser.username;
      const userElement = document.getElementById(`user-${userId}`);
      if (userElement) {
        return userElement.querySelector('.userName').textContent;
      }
      return null;
    })
    .filter(name => name !== null);

  if (typingUserNames.length === 0) {
    typingIndicator.textContent = '';
    typingIndicator.style.display = 'none';
    if (typingIndicator.classList.contains('active')) {
      typingIndicator.classList.add('inactive');
      typingIndicator.classList.remove('active');
      setTimeout(() => {
        typingIndicator.classList.remove('inactive');
        updateReplyIndicatorMargin();
      }, 500);
    } else {
      updateReplyIndicatorMargin();
    }
    return;
  }

  typingIndicator.style.display = 'flex';

  if (typingUserNames.length === 1) {
    typingIndicator.textContent = `${typingUserNames[0]} печатает...`;
  } else if (typingUserNames.length === 2) {
    typingIndicator.textContent = `${typingUserNames[0]} и ${typingUserNames[1]} печатают...`;
  } else if (typingUserNames.length > 2) {
    typingIndicator.textContent = `${typingUserNames.length} пользователей печатают...`;
  } else {
    typingIndicator.textContent = '';
  }
  if (typingIndicator.textContent && !typingIndicator.classList.contains('active')) {
    typingIndicator.classList.remove('inactive');
    typingIndicator.classList.add('active');
  }
  updateReplyIndicatorMargin();
}

function showConnectionInfo() {
  console.log("Информационное окно отключено");
}

function setupLoginForm() {
  const loginForm = document.getElementById('login-form');
  const usernameInput = document.getElementById('username-input');
  
  loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const username = usernameInput.value.trim();
    const tunnelUrl = document.getElementById('tunnel-url').value.trim();
    
    if (!username) {
      showConfirmModal("Поле не заполнено", "Пожалуйста, введите ваше имя", false);
      return;
    }
    
    if (username.length < 3 || username.length > 20) {
      showConfirmModal("Некорректное имя", "Имя должно содержать от 3 до 20 символов", false);
      return;
    }
    
    if (!tunnelUrl) {
      showConfirmModal("Поле не заполнено", "Пожалуйста, введите URL сервера", false);
      return;
    }
    
    const isAdmin = ADMIN_USERNAMES.map(name => name.toLowerCase()).includes(username.toLowerCase());
    const isModerator = ['kirymeww'].includes(username.toLowerCase());

    if (isAdmin) {
      showAdminConfirmModal(() => {
        completeLogin(username, tunnelUrl, true);
      });
    } else if (isModerator) {
      showModeratorConfirmModal(() => {
        completeLogin(username, tunnelUrl, false, true);
      });
    } else {
      completeLogin(username, tunnelUrl, false);
    }
  });
}

function completeLogin(username, tunnelUrl, isAdmin = false, isModerator = false) {
  let formattedUrl = tunnelUrl.trim();
  
  if (!formattedUrl.match(/^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z0-9-]+(:[0-9]+)?(\/.*)?$/)) {
    showConfirmModal(
      "Некорректный URL", 
      "Введенный URL имеет некорректный формат. Пример правильного формата: example.ngrok.io", 
      false
    );
    return;
  }
  
  const mainSocket = initializeSocket(formattedUrl);
  
  if (mainSocket) {
    showConfirmModal(
      `Подтвердите действие на ${formattedUrl}`,
      `Вы хотите подключиться к серверу как ${username}?`,
      true,
      () => {
        let userId = null;
        joinChat(mainSocket, username, userId, isAdmin, isModerator);
      }
    );
  }
}

function joinChat(socket, username, userId, isAdmin = false, isModerator = false) {
  const userData = {
    username: username,
    isAdmin: isAdmin,
    isModerator: isModerator
  };
  
  if (userId) {
    userData.id = userId;
  }
  
  console.log("Отправляем данные пользователя:", userData);
  
  socket.once('welcome', (data) => {
    console.log("Получено приветствие от сервера:", data);
    
    initChat(data);
  });
  
  socket.emit('join', userData);
  
  setTimeout(() => {
    if (document.getElementById('login-form').style.display !== 'none') {
      console.log("Не получено подтверждение входа, возможно проблема с подключением");
      showConfirmModal(
        "Проблема с подключением", 
        "Не удалось войти в чат. Проверьте URL сервера и попробуйте снова.", 
        false
      );
    }
  }, 5000);
}

function initializeSocket(ngrokUrl, isTemp = false) {
  try {
    if (typeof io === 'undefined') {
      console.error('Socket.IO library is not loaded');
      if (!isTemp) {
        showConfirmModal(
          "Ошибка инициализации", 
          "Библиотека Socket.IO не загружена. Проверьте подключение к интернету и перезагрузите страницу.", 
          false
        );
      }
      return null;
    }
    
    if (!ngrokUrl || ngrokUrl.trim() === '') {
      console.error('Empty URL provided');
      if (!isTemp) {
        showConfirmModal("Ошибка подключения", "Не указан URL сервера", false);
      }
      return null;
    }
    
    let socketUrl = ngrokUrl.trim();
    
    if (socketUrl.endsWith('/')) {
      socketUrl = socketUrl.slice(0, -1);
    }
    
    if (!socketUrl.startsWith('http://') && !socketUrl.startsWith('https://')) {
      socketUrl = `https://${socketUrl}`;
    }
    
    console.log(`Connecting to socket at ${socketUrl}`);
    
    if (socket && !isTemp) {
      socket.disconnect();
    }
    
    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: MAX_RETRY_ATTEMPTS,
      reconnectionDelay: 1000,
      timeout: 10000 
    });
    
    newSocket.on('connect', () => {
      console.log('Connected to server');
      connectionAttempts = 0;
    });
    
    newSocket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      connectionAttempts++;
      
      if (connectionAttempts <= MAX_RETRY_ATTEMPTS) {
        console.log(`Retrying connection (${connectionAttempts}/${MAX_RETRY_ATTEMPTS})...`);
        setTimeout(() => {
          newSocket.connect();
        }, 2000);
      } else {
        if (!isTemp) {
          showConfirmModal(
            "Ошибка подключения", 
            `Не удалось подключиться к серверу по адресу ${socketUrl}. Проверьте URL и убедитесь, что сервер запущен.`, 
            false
          );
        }
      }
    });
    
    if (!isTemp) {
      socket = newSocket;
      setupChatEvents();
    }
    
    return newSocket;
  } catch (error) {
    console.error('Failed to initialize socket:', error);
    if (!isTemp) {
      showConfirmModal("Ошибка инициализации", "Произошла ошибка при инициализации соединения", false);
    }
    return null;
  }
}

function closeAllModals() {
  const overlay = document.getElementById('modal-overlay');
  overlay.style.display = 'none';
  const modals = [
    document.getElementById('confirm-action-modal'),
    document.getElementById('admin-confirm-modal'),
    document.getElementById('moderator-confirm-modal')
  ];
  modals.forEach(modal => {
    if (modal) modal.style.display = 'none';
  });
}

function showAdminConfirmModal(confirmCallback) {
  closeAllModals();
  setTimeout(() => {
    const modal = document.getElementById('admin-confirm-modal');
    const passwordInput = document.getElementById('admin-password-input');
    const cancelBtn = document.getElementById('admin-cancel-action');
    const confirmBtn = document.getElementById('admin-confirm-action');
    const overlay = document.getElementById('modal-overlay');

    overlay.style.display = 'block';

    passwordInput.value = '';

    const closeModal = () => {
      modal.style.display = 'none';
      overlay.style.display = 'none';
      cancelBtn.removeEventListener('click', closeModal);
      confirmBtn.removeEventListener('click', handleConfirm);
      passwordInput.removeEventListener('keydown', keydownHandler);
      overlay.removeEventListener('click', closeModal);
    };

    const handleConfirm = () => {
      const password = passwordInput.value;
      if (password === ADMIN_PASSWORD) {
        if (confirmCallback) {
          confirmCallback();
        }
        closeModal();
      } else {
        closeModal();
        showConfirmModal("Неверный пароль", "Вы ввели неверный пароль администратора.", false);
      }
    };
    
    const keydownHandler = (e) => {
      if (e.key === 'Enter') {
        handleConfirm();
      } else if (e.key === 'Escape') {
        closeModal();
      }
    };

    cancelBtn.removeEventListener('click', closeModal);
    confirmBtn.removeEventListener('click', handleConfirm);
    passwordInput.removeEventListener('keydown', keydownHandler);
    overlay.removeEventListener('click', closeModal);

    cancelBtn.addEventListener('click', closeModal);
    confirmBtn.addEventListener('click', handleConfirm);
    passwordInput.addEventListener('keydown', keydownHandler);
    overlay.addEventListener('click', closeModal);

    overlay.style.display = 'block';
    modal.style.display = 'block';
    passwordInput.focus();
  }, 0);
}

function showModeratorConfirmModal(confirmCallback) {
  closeAllModals();
  setTimeout(() => {
    const modal = document.getElementById('moderator-confirm-modal');
    const passwordInput = document.getElementById('moderator-password-input');
    const cancelBtn = document.getElementById('moderator-cancel-action');
    const confirmBtn = document.getElementById('moderator-confirm-action');
    const overlay = document.getElementById('modal-overlay');

    overlay.style.display = 'block';

    passwordInput.value = '';

    const closeModal = () => {
      modal.style.display = 'none';
      overlay.style.display = 'none';
      cancelBtn.removeEventListener('click', closeModal);
      confirmBtn.removeEventListener('click', handleConfirm);
      passwordInput.removeEventListener('keydown', keydownHandler);
      overlay.removeEventListener('click', closeModal);
    };

    const handleConfirm = () => {
      const password = passwordInput.value;
      if (password === MODERATOR_PASSWORD) {
        if (confirmCallback) {
          confirmCallback();
        }
        closeModal();
      } else {
        closeModal();
        showConfirmModal("Неверный пароль", "Вы ввели неверный пароль модератора.", false);
      }
    };
    
    const keydownHandler = (e) => {
      if (e.key === 'Enter') {
        handleConfirm();
      } else if (e.key === 'Escape') {
        closeModal();
      }
    };

    cancelBtn.removeEventListener('click', closeModal);
    confirmBtn.removeEventListener('click', handleConfirm);
    passwordInput.removeEventListener('keydown', keydownHandler);
    overlay.removeEventListener('click', closeModal);

    cancelBtn.addEventListener('click', closeModal);
    confirmBtn.addEventListener('click', handleConfirm);
    passwordInput.addEventListener('keydown', keydownHandler);
    overlay.addEventListener('click', closeModal);

    overlay.style.display = 'block';
    modal.style.display = 'block';
    passwordInput.focus();
  }, 0);
}

function showConfirmModal(title, message, showCancel = true, confirmCallback = null) {
  closeAllModals();
  setTimeout(() => {
    const modal = document.getElementById('confirm-action-modal');
    const titleEl = document.getElementById('confirm-title');
    const messageEl = document.getElementById('confirm-message');
    const cancelBtn = document.getElementById('cancel-action');
    const confirmBtn = document.getElementById('confirm-action');
    const overlay = document.getElementById('modal-overlay');
    
    overlay.style.display = 'block';
    titleEl.textContent = title;
    messageEl.textContent = message;
    
    cancelBtn.style.display = showCancel ? 'block' : 'none';
    
    const closeModal = () => {
      modal.style.display = 'none';
      overlay.style.display = 'none';
      cancelBtn.removeEventListener('click', closeModal);
      confirmBtn.removeEventListener('click', handleConfirm);
      overlay.removeEventListener('click', closeModal);
    };
    
    const handleConfirm = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (confirmCallback) {
        confirmCallback();
      }
      closeModal();
    };
    
    modal.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    
    cancelBtn.removeEventListener('click', closeModal);
    confirmBtn.removeEventListener('click', handleConfirm);
    overlay.removeEventListener('click', closeModal);
    
    overlay.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    confirmBtn.addEventListener('click', handleConfirm);
    
    overlay.style.display = 'block';
    modal.style.display = 'block';
  }, 0);
}

function checkNetworkStatus() {
  return navigator.onLine;
}

document.addEventListener('DOMContentLoaded', () => {
  if (!checkNetworkStatus()) {
    showConfirmModal(
      "Нет подключения к интернету", 
      "Проверьте ваше интернет-соединение и перезагрузите страницу.", 
      false
    );
  }
  
  window.addEventListener('online', () => {
    console.log('Соединение с интернетом восстановлено');
    createNotificationToast('Соединение с интернетом восстановлено');
    
    if (socket) {
      socket.connect();
    }
  });
  
  window.addEventListener('offline', () => {
    console.log('Соединение с интернетом потеряно');
    createNotificationToast('Соединение с интернетом потеряно');
    showConfirmModal(
      "Нет подключения к интернету", 
      "Проверьте ваше интернет-соединение для продолжения работы чата.", 
      false
    );
  });
  
  setupLoginForm();
  
  document.addEventListener('click', function(e) {
    if (activeMessageMenu && !e.target.closest('.message-context-menu') && !e.target.closest('.message-actions')) {
      closeMessageMenu();
    }
  });
});

function updateUserAvatar(newAvatarSrc) {
  if (!socket || !currentUser.username) return;
  
  const avatarPathForServer = newAvatarSrc.replace('public/', '');
  
  socket.emit('updateAvatar', {
    avatar: avatarPathForServer
  });
}

function showAvatarSelector() {
  
  const modal = document.createElement('div');
  modal.className = 'avatar-selector-modal';
  modal.style.position = 'fixed';
  modal.style.top = '50%';
  modal.style.left = '50%';
  modal.style.transform = 'translate(-50%, -50%)';
  modal.style.backgroundColor = 'var(--card-background)';
  modal.style.borderRadius = '16px';
  modal.style.padding = '20px';
  modal.style.boxShadow = '0 5px 20px rgba(0, 0, 0, 0.5)';
  modal.style.zIndex = '1000';
  modal.style.maxWidth = '90%';
  modal.style.width = '500px';
  modal.style.border = '1px solid var(--border-color)';
  
  const title = document.createElement('h3');
  title.textContent = 'Выберите новую аватарку';
  title.style.textAlign = 'center';
  title.style.marginTop = '0';
  title.style.marginBottom = '20px';
  title.style.color = 'var(--text-color)';
  modal.appendChild(title);
  
  const tabsContainer = document.createElement('div');
  tabsContainer.style.display = 'flex';
  tabsContainer.style.justifyContent = 'center';
  tabsContainer.style.gap = '10px';
  tabsContainer.style.marginBottom = '0';
  tabsContainer.style.paddingBottom = '0';
  modal.appendChild(tabsContainer);
  
  const tabsSeparator = document.createElement('div');
  tabsSeparator.className = 'avatar-tabs-separator';
  tabsSeparator.style.margin = '16px 0';
  modal.appendChild(tabsSeparator);
  
  const avatarContainer = document.createElement('div');
  avatarContainer.style.display = 'flex';
  avatarContainer.style.flexWrap = 'wrap';
  avatarContainer.style.justifyContent = 'center';
  avatarContainer.style.maxWidth = '320px';
  avatarContainer.style.margin = '0 auto';
  avatarContainer.style.gap = '10px';
  avatarContainer.style.marginBottom = '20px';
  avatarContainer.style.minHeight = '200px';
  modal.appendChild(avatarContainer);
  
  const buttonsContainer = document.createElement('div');
  buttonsContainer.style.display = 'flex';
  buttonsContainer.style.justifyContent = 'center';
  buttonsContainer.style.gap = '10px';
  modal.appendChild(buttonsContainer);
  
  let selectedAvatarSrc = null;
  let currentCategory = null;
  let categories = {};
  
  function createTab(categoryName, avatarsArray, locked = false) {
    const tab = document.createElement('button');
    tab.className = 'avatar-category-tab';
    tab.textContent = CATEGORY_LABELS[categoryName] || categoryName;
    if (locked) {
      tab.classList.add('locked');
      tab.disabled = true;
      tab.style.opacity = '0.6';
      tab.style.cursor = 'not-allowed';
      tab.textContent += ' ';
      const lockIcon = document.createElement('img');
      lockIcon.src = 'public/Images/lock.png';
      lockIcon.alt = 'locked';
      lockIcon.style.width = '16px';
      lockIcon.style.height = '16px';
      lockIcon.style.verticalAlign = 'middle';
      lockIcon.style.filter = 'invert(1)';
      tab.appendChild(lockIcon);
    }
    tab.addEventListener('click', function() {
      if (locked) return;
      currentCategory = categoryName;
      currentPage = 1;
      renderTabs(categories, currentCategory);
      renderAvatars(categories[currentCategory]);
    });
    return tab;
  }
  
  const AVATARS_PER_PAGE = 28;
  let currentPage = 1;
  let currentAvatars = [];
  let pagination = null;

  function getPaginationPages(current, total) {
    const delta = 1;
    const range = [];
    const rangeWithDots = [];
    let l;
    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
        range.push(i);
      }
    }
    for (let i of range) {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l > 2) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    }
    return rangeWithDots;
  }

  function renderTabs(categories, currentCategory) {
    tabsContainer.innerHTML = '';
    const categoryNames = Object.keys(categories);
    let filteredCategoryNames = categoryNames.filter(name => Array.isArray(categories[name]) && categories[name].length > 0);
    console.log('currentUser:', currentUser);
    if (currentUser.isAdmin) {
      filteredCategoryNames.forEach(name => {
        const tab = createTab(name, categories[name]);
        if (name === currentCategory) tab.classList.add('primary');
        tabsContainer.appendChild(tab);
      });
    } else if (currentUser.isModerator) {
      ['Animals', 'Premium', 'Moderator'].forEach(name => {
        if (filteredCategoryNames.includes(name)) {
          const tab = createTab(name, categories[name]);
          if (name === currentCategory) tab.classList.add('primary');
          tabsContainer.appendChild(tab);
        }
      });
    } else if (currentUser.isPremium) {
      ['Animals', 'Premium'].forEach(name => {
        if (filteredCategoryNames.includes(name)) {
          const tab = createTab(name, categories[name]);
          if (name === currentCategory) tab.classList.add('primary');
          tabsContainer.appendChild(tab);
        }
      });
    } else {
      if (filteredCategoryNames.includes('Animals')) {
        const tab = createTab('Animals', categories['Animals']);
        if ('Animals' === currentCategory) tab.classList.add('primary');
        tabsContainer.appendChild(tab);
      }
      if (filteredCategoryNames.includes('Premium')) {
        const tab = createTab('Premium', categories['Premium'], true);
        tabsContainer.appendChild(tab);
      }
    }
  }

  function renderAvatars(avatars) {
    currentAvatars = avatars;
    avatarContainer.innerHTML = '';
    if (avatars && avatars.length <= 4) {
      avatarContainer.style.maxWidth = 'none';
      avatarContainer.style.gap = '4px';
    } else {
      avatarContainer.style.maxWidth = '320px';
      avatarContainer.style.gap = '10px';
    }
    if (!avatars || avatars.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.textContent = 'Нет доступных аватарок';
      emptyMsg.style.textAlign = 'center';
      emptyMsg.style.color = 'var(--text-color)';
      emptyMsg.style.margin = '32px 0 24px 0';
      avatarContainer.appendChild(emptyMsg);
      if (pagination) {
        pagination.remove();
        pagination = null;
      }
      return;
    }
    const totalPages = Math.ceil(avatars.length / AVATARS_PER_PAGE);
    let nonEmptyPages = [];
    for (let i = 1; i <= totalPages; i++) {
      const pageStart = (i - 1) * AVATARS_PER_PAGE;
      const pageEnd = pageStart + AVATARS_PER_PAGE;
      if (avatars.slice(pageStart, pageEnd).length > 0) {
        nonEmptyPages.push(i);
      }
    }
    if (nonEmptyPages.length === 0) nonEmptyPages = [1];
    if (!nonEmptyPages.includes(currentPage)) currentPage = nonEmptyPages[0] || 1;
    const startIdx = (currentPage - 1) * AVATARS_PER_PAGE;
    const endIdx = startIdx + AVATARS_PER_PAGE;
    const pageAvatars = avatars.slice(startIdx, endIdx);
    pageAvatars.forEach((avatarSrc, idx) => {
      if (pageAvatars.length > 8 && idx === 4) {
        const separator = document.createElement('div');
        separator.className = 'avatars-separator';
        avatarContainer.appendChild(separator);
      }
      const avatarOption = document.createElement('img');
      avatarOption.src = 'public/' + avatarSrc;
      avatarOption.className = 'avatarOption';
      avatarOption.style.width = '50px';
      avatarOption.style.height = '50px';
      avatarOption.style.borderRadius = '50%';
      avatarOption.style.cursor = 'pointer';
      avatarOption.style.border = '2px solid transparent';
      avatarOption.style.transition = 'all 0.2s ease';
      avatarOption.style.objectFit = 'cover';
      let userAvatarRelative = currentUser.avatar.replace(/^public\//, '').replace(/^\//, '');
      let avatarSrcRelative = avatarSrc.replace(/^public\//, '').replace(/^\//, '');
      if (userAvatarRelative === avatarSrcRelative) {
        avatarOption.classList.add('selectedAvatar');
        avatarOption.style.borderColor = 'var(--accent-color)';
        avatarOption.style.boxShadow = '0 0 0 4px rgba(var(--accent-color-rgb), 0.7)';
        selectedAvatarSrc = avatarSrc;
      }
      avatarOption.addEventListener('click', function() {
        avatarContainer.querySelectorAll('.avatarOption').forEach(avatar => {
          avatar.classList.remove('selectedAvatar');
          avatar.style.borderColor = 'transparent';
          avatar.style.boxShadow = 'none';
        });
        this.classList.add('selectedAvatar');
        this.style.borderColor = 'var(--accent-color)';
        this.style.boxShadow = '0 0 0 4px rgba(var(--accent-color-rgb), 0.7)';
        selectedAvatarSrc = avatarSrc;
      });
      avatarOption.addEventListener('mouseenter', function() {
        if (!this.classList.contains('selectedAvatar')) {
          this.style.transform = 'scale(1.1)';
          this.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
        }
      });
      avatarOption.addEventListener('mouseleave', function() {
        if (!this.classList.contains('selectedAvatar')) {
          this.style.transform = 'scale(1)';
          this.style.boxShadow = 'none';
        }
      });
      avatarContainer.appendChild(avatarOption);
    });
    if (nonEmptyPages.length >= 1) {
      if (pagination) {
        pagination.remove();
        pagination = null;
      }
      pagination = document.createElement('div');
      pagination.style.display = 'flex';
      pagination.style.justifyContent = 'center';
      pagination.style.alignItems = 'center';
      pagination.style.gap = '4px';
      pagination.style.marginTop = '8px';
      pagination.style.marginBottom = '18px';
      const pagesToShow = getPaginationPages(currentPage, nonEmptyPages.length);
      pagesToShow.forEach(p => {
        if (p === '...') {
          const dots = document.createElement('span');
          dots.textContent = '...';
          dots.style.padding = '0 10px';
          dots.style.fontSize = '18px';
          dots.style.color = 'var(--text-color)';
          pagination.appendChild(dots);
        } else {
          const realPage = nonEmptyPages[p - 1] || 1;
          const pageBtn = document.createElement('button');
          pageBtn.className = 'avatar-page-tab';
          if (realPage === currentPage) pageBtn.classList.add('primary');
          pageBtn.textContent = realPage;
          pageBtn.type = 'button';
          pageBtn.style.minWidth = '36px';
          pageBtn.style.padding = '6px 12px';
          pageBtn.style.margin = '0 2px';
          pageBtn.addEventListener('click', () => {
            currentPage = realPage;
            renderAvatars(currentAvatars);
          });
          pagination.appendChild(pageBtn);
        }
      });
      modal.insertBefore(pagination, buttonsContainer);
    } else if (pagination) {
      pagination.remove();
      pagination = null;
    }
  }
  
  if (socket) {
    socket.emit('getAvatarCategories');
    socket.once('avatarCategories', (receivedCategories) => {
      categories = receivedCategories;
      console.log('Категории аватарок:', categories);
      if (!currentCategory || !categories[currentCategory]) {
        currentCategory = Object.keys(categories)[0];
      }
      renderTabs(categories, currentCategory);
      renderAvatars(categories[currentCategory]);
    });
  }
  
  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Отмена';
  cancelButton.className = 'button';
  cancelButton.style.padding = '10px 20px';
  cancelButton.style.borderRadius = '8px';
  cancelButton.style.border = '1px solid var(--border-color)';
  cancelButton.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
  cancelButton.style.color = 'var(--text-color)';
  cancelButton.style.cursor = 'pointer';
  cancelButton.addEventListener('click', function() {
    document.body.removeChild(overlay);
    document.body.removeChild(modal);
  });
  buttonsContainer.appendChild(cancelButton);
  
  const saveButton = document.createElement('button');
  saveButton.textContent = 'Сохранить';
  saveButton.className = 'button primary';
  saveButton.style.padding = '10px 20px';
  saveButton.style.borderRadius = '8px';
  saveButton.style.border = 'none';
  saveButton.style.background = 'var(--button-gradient)';
  saveButton.style.color = 'white';
  saveButton.style.cursor = 'pointer';
  saveButton.addEventListener('click', function() {
    if (selectedAvatarSrc !== null) {
      updateUserAvatar('public/' + selectedAvatarSrc);
    }
    document.body.removeChild(overlay);
    document.body.removeChild(modal);
  });
  buttonsContainer.appendChild(saveButton);
  
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  overlay.style.zIndex = '999';
  overlay.addEventListener('click', function() {
    document.body.removeChild(overlay);
    document.body.removeChild(modal);
  });
  
  modal.addEventListener('click', function(e) {
    e.stopPropagation();
  });
  
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  
}

function startReplyToMessage(messageId) {
  const messageWrapper = document.querySelector(`.messageWrapper[data-message-id="${messageId}"]`);
  if (!messageWrapper) return;
  
  const messageTextElement = messageWrapper.querySelector('.messageText');
  const messageSenderElement = messageWrapper.querySelector('.messageSender');
  if (!messageTextElement || !messageSenderElement) return;
  
  const replyText = messageTextElement.textContent;
  const replyUsername = messageSenderElement.textContent || currentUser.username;
  
  replyingToMessageId = messageId;
  
  const messageInput = document.getElementById('message-input');
  const currentInputText = messageInput.value;
  
  const previousState = {
    text: currentInputText,
    placeholder: messageInput.placeholder
  };
  
  messageInput.placeholder = `Ответить на сообщение от ${replyUsername}...`;
  messageInput.focus();
  
  showReplyIndicator(messageId, replyText, replyUsername);
  
  const cancelReplyHandler = function(e) {
    if (e.key === 'Escape') {
      cancelReply();
      document.removeEventListener('keydown', cancelReplyHandler);
    }
  };
  document.addEventListener('keydown', cancelReplyHandler);
}

function showReplyIndicator(messageId, replyText, replyUsername) {
  hideReplyIndicator();
  let replyIndicator = document.createElement('div');
  replyIndicator.className = 'replyIndicator';
  replyIndicator.innerHTML = `
    <div class="replyIndicatorContent">
      <div class="replyIndicatorText">
        <span class="replyIndicatorAuthor">${replyUsername}</span>
        <span class="replyIndicatorMessage">${replyText}</span>
      </div>
      <button class="replyIndicatorCancel" onclick="cancelReply()">✕</button>
    </div>
  `;
  const inputArea = document.querySelector('.inputArea');
  const typingIndicator = document.getElementById('typing-indicator');
  if (inputArea && inputArea.parentNode) {
    inputArea.parentNode.insertBefore(replyIndicator, inputArea);
  }
  updateReplyIndicatorMargin();
}

function hideReplyIndicator() {
  const existingIndicator = document.querySelector('.replyIndicator');
  if (existingIndicator) existingIndicator.remove();
}

function updateReplyIndicatorMargin() {
  const replyIndicator = document.querySelector('.replyIndicator');
  const typingIndicator = document.getElementById('typing-indicator');
  if (replyIndicator) {
    if (typingIndicator && typingIndicator.classList.contains('active') && typingIndicator.textContent) {
      replyIndicator.style.marginBottom = '32px';
    } else {
      replyIndicator.style.marginBottom = '8px';
    }
  }
}

function cancelReply() {
  replyingToMessageId = null;
  hideReplyIndicator();
  
  const messageInput = document.getElementById('message-input');
  messageInput.placeholder = 'Введите сообщение...';
}

function scrollToMessage(messageId) {
  const messageElement = document.querySelector(`.messageWrapper[data-message-id="${messageId}"]`);
  if (messageElement) {
    messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    const contentElement = messageElement.querySelector('.messageContent');
    if (contentElement) {
      contentElement.classList.add('highlighted');
      setTimeout(() => {
        contentElement.classList.remove('highlighted');
      }, 2000);
    }
  }
}