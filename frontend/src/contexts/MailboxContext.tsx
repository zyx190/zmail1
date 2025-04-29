import React, { createContext, useState, useEffect, ReactNode, useRef } from 'react';
import { 
  createRandomMailbox, 
  getMailboxFromLocalStorage, 
  saveMailboxToLocalStorage,
  removeMailboxFromLocalStorage,
  getEmails,
  deleteMailbox as apiDeleteMailbox
} from '../utils/api';
import { useTranslation } from 'react-i18next';
import { DEFAULT_AUTO_REFRESH, AUTO_REFRESH_INTERVAL } from '../config';

// 邮件详情缓存接口
interface EmailCache {
  [emailId: string]: {
    email: Email;
    attachments: any[];
    timestamp: number;
  }
}

interface MailboxContextType {
  mailbox: Mailbox | null;
  setMailbox: (mailbox: Mailbox) => void;
  isLoading: boolean;
  emails: Email[];
  setEmails: (emails: Email[]) => void;
  selectedEmail: string | null;
  setSelectedEmail: (id: string | null) => void;
  isEmailsLoading: boolean;
  setIsEmailsLoading: (loading: boolean) => void;
  autoRefresh: boolean;
  setAutoRefresh: (autoRefresh: boolean) => void;
  createNewMailbox: () => Promise<void>;
  deleteMailbox: () => Promise<void>;
  refreshEmails: () => Promise<void>;
  emailCache: EmailCache;
  addToEmailCache: (emailId: string, email: Email, attachments: any[]) => void;
  clearEmailCache: () => void;
  handleMailboxNotFound: () => Promise<void>;
  errorMessage: string | null;
  successMessage: string | null;
}

export const MailboxContext = createContext<MailboxContextType>({
  mailbox: null,
  setMailbox: () => {},
  isLoading: false,
  emails: [],
  setEmails: () => {},
  selectedEmail: null,
  setSelectedEmail: () => {},
  isEmailsLoading: false,
  setIsEmailsLoading: () => {},
  autoRefresh: DEFAULT_AUTO_REFRESH,
  setAutoRefresh: () => {},
  createNewMailbox: async () => {},
  deleteMailbox: async () => {},
  refreshEmails: async () => {},
  emailCache: {},
  addToEmailCache: () => {},
  clearEmailCache: () => {},
  handleMailboxNotFound: async () => {},
  errorMessage: null,
  successMessage: null
});

interface MailboxProviderProps {
  children: ReactNode;
}

export const MailboxProvider: React.FC<MailboxProviderProps> = ({ children }) => {
  const { t } = useTranslation();
  const [mailbox, setMailbox] = useState<Mailbox | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [isEmailsLoading, setIsEmailsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(DEFAULT_AUTO_REFRESH);
  const [emailCache, setEmailCache] = useState<EmailCache>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const errorTimeoutRef = useRef<number | null>(null);
  const successTimeoutRef = useRef<number | null>(null);
  
  // 清除提示的定时器
  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        window.clearTimeout(errorTimeoutRef.current);
      }
      if (successTimeoutRef.current) {
        window.clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);
  
  // 初始化：检查本地存储或创建新邮箱
  useEffect(() => {
    const initMailbox = async () => {
      // 检查本地存储中是否有未过期的邮箱
      const savedMailbox = getMailboxFromLocalStorage();
      
      if (savedMailbox) {
        setMailbox(savedMailbox);
        setIsLoading(false);
      } else {
        // 创建新邮箱
        await createNewMailbox();
      }
    };
    
    initMailbox();
  }, []);
  
  // 创建新邮箱
  const createNewMailbox = async () => {
    try {
      // 清除之前的错误和成功信息
      setErrorMessage(null);
      setSuccessMessage(null);
      
      console.log('createNewMailbox: Started');
      setIsLoading(true);
      
      console.log('createNewMailbox: Calling createRandomMailbox...');
      const result = await createRandomMailbox();
      console.log('createNewMailbox: createRandomMailbox result:', result);
      
      if (result.success && result.mailbox) {
        console.log('createNewMailbox: Setting new mailbox:', result.mailbox);
        setMailbox(result.mailbox);
        saveMailboxToLocalStorage(result.mailbox);
      } else {
        console.error('createNewMailbox: Failed to create mailbox:', result.error);
        setErrorMessage(t('mailbox.createFailed'));
        
        // 3秒后清除错误信息
        if (errorTimeoutRef.current) {
          window.clearTimeout(errorTimeoutRef.current);
        }
        errorTimeoutRef.current = window.setTimeout(() => {
          setErrorMessage(null);
        }, 3000);
        throw new Error('Failed to create mailbox');
      }
    } catch (error) {
      console.error('createNewMailbox: Error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };
  
  // 删除邮箱
  const deleteMailbox = async () => {
    if (!mailbox) return;
    
    try {
      // 清除之前的错误和成功信息
      setErrorMessage(null);
      setSuccessMessage(null);
      
      // 调用API删除邮箱
      const result = await apiDeleteMailbox(mailbox.address);
      
      if (result.success) {
        // 显示成功信息
        setSuccessMessage(t('mailbox.deleteSuccess'));
        
        // 清除本地数据
        setMailbox(null);
        setEmails([]);
        setSelectedEmail(null);
        removeMailboxFromLocalStorage();
        clearEmailCache();
        
        // 3秒后清除成功信息
        if (successTimeoutRef.current) {
          window.clearTimeout(successTimeoutRef.current);
        }
        successTimeoutRef.current = window.setTimeout(() => {
          setSuccessMessage(null);
        }, 3000);
        
        // 创建新邮箱
        await createNewMailbox();
      } else {
        // 显示错误信息
        setErrorMessage(t('mailbox.deleteFailed'));
        
        // 3秒后清除错误信息
        if (errorTimeoutRef.current) {
          window.clearTimeout(errorTimeoutRef.current);
        }
        errorTimeoutRef.current = window.setTimeout(() => {
          setErrorMessage(null);
        }, 3000);
      }
    } catch (error) {
      console.error('Error deleting mailbox:', error);
      
      // 显示错误信息
      setErrorMessage(t('mailbox.deleteFailed'));
      
      // 3秒后清除错误信息
      if (errorTimeoutRef.current) {
        window.clearTimeout(errorTimeoutRef.current);
      }
      errorTimeoutRef.current = window.setTimeout(() => {
        setErrorMessage(null);
      }, 3000);
    }
  };
  
  // 刷新邮件列表
  const refreshEmails = async () => {
    if (!mailbox) return;
    
    // 防止重复请求
    if (isEmailsLoading) return;
    
    setIsEmailsLoading(true);
    
    try {
      const result = await getEmails(mailbox.address);
      
      if (result.success) {
        setEmails(result.emails);
      } else if (result.notFound) {
        // 如果邮箱不存在，清除本地缓存并创建新邮箱
        try {
          // 直接调用handleMailboxNotFound函数
          await handleMailboxNotFound();
        } catch (error) {
          // 出错时也尝试清除缓存并创建新邮箱
          setMailbox(null);
          setEmails([]);
          setSelectedEmail(null);
          removeMailboxFromLocalStorage();
          clearEmailCache();
          
          // 刷新页面
          window.location.href = '/';
        }
      }
    } catch (error) {
      // 错误处理
      console.error('Error refreshing emails:', error);
    } finally {
      setIsEmailsLoading(false);
    }
  };
  
  // 自动刷新邮件
  useEffect(() => {
    if (!mailbox) return;
    
    // 首次加载邮件（无论autoRefresh是否开启）
    refreshEmails();
    
    // 如果自动刷新开启，则设置定时器
    let intervalId: number | undefined;
    if (autoRefresh) {
      intervalId = window.setInterval(refreshEmails, AUTO_REFRESH_INTERVAL);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [mailbox, autoRefresh]);
  
  // 处理邮箱不存在的情况
  const handleMailboxNotFound = async () => {
    try {
      // 清除之前的错误和成功信息
      setErrorMessage(null);
      setSuccessMessage(null);
      
      setSuccessMessage(t('mailbox.creatingNew'));
      
      // 清除当前邮箱信息
      setMailbox(null);
      setEmails([]);
      setSelectedEmail(null);
      removeMailboxFromLocalStorage();
      clearEmailCache();
      
      // 创建新邮箱
      try {
        const result = await createRandomMailbox();
        
        if (result.success && result.mailbox) {
          // 直接保存到localStorage，而不是通过setMailbox触发状态更新
          saveMailboxToLocalStorage(result.mailbox);
          
          // 直接刷新页面，让页面重新加载时从localStorage获取新邮箱
          window.location.href = '/'; // 使用href而不是reload，确保导航到首页
        } else {
          throw new Error('Failed to create mailbox');
        }
      } catch (error) {
        throw error;
      }
    } catch (error) {
      throw error;
    }
  };
  
  // 添加邮件到缓存
  const addToEmailCache = (emailId: string, email: Email, attachments: any[]) => {
    setEmailCache(prev => ({
      ...prev,
      [emailId]: {
        email,
        attachments,
        timestamp: Date.now()
      }
    }));
    
    // 保存到localStorage
    try {
      const mailboxAddress = mailbox?.address;
      if (mailboxAddress) {
        const cacheKey = `emailCache_${mailboxAddress}`;
        const updatedCache = {
          ...emailCache,
          [emailId]: {
            email,
            attachments,
            timestamp: Date.now()
          }
        };
        localStorage.setItem(cacheKey, JSON.stringify(updatedCache));
      }
    } catch (error) {
      console.error('Error saving email cache to localStorage:', error);
    }
  };
  
  // 清除邮件缓存
  const clearEmailCache = () => {
    setEmailCache({});
    
    // 清除localStorage中的缓存
    try {
      const mailboxAddress = mailbox?.address;
      if (mailboxAddress) {
        const cacheKey = `emailCache_${mailboxAddress}`;
        localStorage.removeItem(cacheKey);
      }
    } catch (error) {
      console.error('Error clearing email cache from localStorage:', error);
    }
  };
  
  // 从localStorage加载邮件缓存
  useEffect(() => {
    if (!mailbox) return;
    
    try {
      const cacheKey = `emailCache_${mailbox.address}`;
      const cachedData = localStorage.getItem(cacheKey);
      
      if (cachedData) {
        const parsedCache = JSON.parse(cachedData);
        setEmailCache(parsedCache);
      }
    } catch (error) {
      console.error('Error loading email cache from localStorage:', error);
    }
  }, [mailbox]);
  
  // 设置邮箱并保存到localStorage
  const handleSetMailbox = (newMailbox: Mailbox) => {
    setMailbox(newMailbox);
    saveMailboxToLocalStorage(newMailbox);
  };
  
  return (
    <MailboxContext.Provider
      value={{
        mailbox,
        setMailbox: handleSetMailbox,
        isLoading,
        emails,
        setEmails,
        selectedEmail,
        setSelectedEmail,
        isEmailsLoading,
        setIsEmailsLoading,
        autoRefresh,
        setAutoRefresh,
        createNewMailbox,
        deleteMailbox,
        refreshEmails,
        emailCache,
        addToEmailCache,
        clearEmailCache,
        handleMailboxNotFound,
        errorMessage,
        successMessage
      }}
    >
      {/* 错误和成功提示 */}
      {(errorMessage || successMessage) && (
        <div className="fixed top-4 right-4 z-50 p-3 rounded-md shadow-lg max-w-md" style={{ backgroundColor: errorMessage ? '#FEE2E2' : '#ECFDF5', color: errorMessage ? '#991B1B' : '#065F46' }}>
          {errorMessage || successMessage}
        </div>
      )}
      {children}
    </MailboxContext.Provider>
  );
}; 