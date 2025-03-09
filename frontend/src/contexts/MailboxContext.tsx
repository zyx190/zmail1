import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { 
  createRandomMailbox, 
  getMailboxFromLocalStorage, 
  saveMailboxToLocalStorage,
  removeMailboxFromLocalStorage,
  getEmails
} from '../utils/api';
import { useToast } from '../components/ui/use-toast';
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
  deleteMailbox: () => void;
  refreshEmails: () => Promise<void>;
  emailCache: EmailCache;
  addToEmailCache: (emailId: string, email: Email, attachments: any[]) => void;
  clearEmailCache: () => void;
  handleMailboxNotFound: () => Promise<void>;
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
  deleteMailbox: () => {},
  refreshEmails: async () => {},
  emailCache: {},
  addToEmailCache: () => {},
  clearEmailCache: () => {},
  handleMailboxNotFound: async () => {}
});

interface MailboxProviderProps {
  children: ReactNode;
}

export const MailboxProvider: React.FC<MailboxProviderProps> = ({ children }) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [mailbox, setMailbox] = useState<Mailbox | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [isEmailsLoading, setIsEmailsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(DEFAULT_AUTO_REFRESH);
  const [emailCache, setEmailCache] = useState<EmailCache>({});
  
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
        toast({
          title: t('errors.generic'),
          description: t('mailbox.createFailed'),
          variant: 'destructive',
        });
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
  const deleteMailbox = () => {
    setMailbox(null);
    setEmails([]);
    setSelectedEmail(null);
    removeMailboxFromLocalStorage();
    createNewMailbox();
  };
  
  // 刷新邮件列表
  const refreshEmails = async () => {
    if (!mailbox) return;
    
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
    } finally {
      setIsEmailsLoading(false);
    }
  };
  
  // 自动刷新邮件
  useEffect(() => {
    if (!mailbox || !autoRefresh) return;
    
    // 首次加载邮件
    refreshEmails();
    
    // 设置定时刷新
    const intervalId = window.setInterval(refreshEmails, AUTO_REFRESH_INTERVAL);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [mailbox, autoRefresh]);
  
  // 处理邮箱不存在的情况
  const handleMailboxNotFound = async () => {
    try {
      toast({
        title: t('mailbox.notFound'),
        description: t('mailbox.creatingNew'),
      });
      
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
        localStorage.removeItem(`emailCache_${mailboxAddress}`);
      }
    } catch (error) {
      console.error('Error clearing email cache from localStorage:', error);
    }
  };
  
  // 从localStorage加载邮件缓存
  useEffect(() => {
    if (mailbox?.address) {
      try {
        const cacheKey = `emailCache_${mailbox.address}`;
        const savedCache = localStorage.getItem(cacheKey);
        if (savedCache) {
          const parsedCache = JSON.parse(savedCache);
          setEmailCache(parsedCache);
        }
      } catch (error) {
        console.error('Error loading email cache from localStorage:', error);
      }
    }
  }, [mailbox?.address]);
  
  // 当邮箱变更时，保存到本地存储
  const handleSetMailbox = (newMailbox: Mailbox) => {
    setMailbox(newMailbox);
    saveMailboxToLocalStorage(newMailbox);
    setEmails([]);
    setSelectedEmail(null);
    // 清除旧邮箱的缓存
    clearEmailCache();
  };
  
  // 保存自动刷新设置到本地存储
  useEffect(() => {
    localStorage.setItem('autoRefresh', String(autoRefresh));
  }, [autoRefresh]);
  
  // 从本地存储加载自动刷新设置
  useEffect(() => {
    const savedAutoRefresh = localStorage.getItem('autoRefresh');
    if (savedAutoRefresh !== null) {
      setAutoRefresh(savedAutoRefresh === 'true');
    }
  }, []);
  
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
        handleMailboxNotFound
      }}
    >
      {children}
    </MailboxContext.Provider>
  );
}; 