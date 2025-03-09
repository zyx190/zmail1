import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import EmailList from '../components/EmailList';
import EmailDetail from '../components/EmailDetail';
import MailboxInfo from '../components/MailboxInfo';
import { useToast } from '../components/ui/use-toast';
import { API_BASE_URL } from '../config';
import { MailboxContext } from '../contexts/MailboxContext';
import { getEmails } from '../utils/api';

const MailboxPage: React.FC = () => {
  const { address } = useParams<{ address: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { handleMailboxNotFound } = useContext(MailboxContext);
  
  const [mailbox, setMailbox] = useState<Mailbox | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // 获取邮箱信息
  useEffect(() => {
    if (!address) return;
    
    const fetchMailbox = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/mailboxes/${address}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            toast({
              title: t('errors.notFound'),
              description: t('mailbox.invalidAddress'),
              variant: 'destructive',
            });
            navigate('/');
            return;
          }
          throw new Error('Failed to fetch mailbox');
        }
        
        const data = await response.json();
        if (data.success) {
          setMailbox(data.mailbox);
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      } catch (error) {
        toast({
          title: t('errors.generic'),
          description: String(error),
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMailbox();
  }, [address, navigate, t, toast]);
  
  // 获取邮件列表
  useEffect(() => {
    if (!address) return;
    
    const fetchEmails = async () => {
      try {
        console.log('MailboxPage: Fetching emails...');
        const result = await getEmails(address);
        console.log('MailboxPage: Fetch emails result:', result);
        
        if (result.success) {
          setEmails(result.emails);
        } else if (result.notFound) {
          console.log('MailboxPage: Mailbox not found, calling handleMailboxNotFound...');
          // 如果邮箱不存在，清除本地缓存并创建新邮箱
          try {
            if (typeof handleMailboxNotFound === 'function') {
              console.log('MailboxPage: handleMailboxNotFound is a function, calling it...');
              await handleMailboxNotFound();
              console.log('MailboxPage: handleMailboxNotFound completed');
            } else {
              console.error('MailboxPage: handleMailboxNotFound is not a function:', handleMailboxNotFound);
              // 如果handleMailboxNotFound不是函数，则直接导航到首页
              navigate('/');
            }
          } catch (error) {
            console.error('MailboxPage: Error in handleMailboxNotFound:', error);
            // 出错时导航到首页
            navigate('/');
          }
          return;
        } else {
          console.error('MailboxPage: Error fetching emails:', result.error);
        }
      } catch (error) {
        console.error('MailboxPage: Error fetching emails:', error);
      }
    };
    
    fetchEmails();
    
    // 自动刷新
    let intervalId: number | undefined;
    if (autoRefresh) {
      intervalId = window.setInterval(fetchEmails, 10000); // 每10秒刷新一次
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [address, autoRefresh, handleMailboxNotFound, navigate]);
  
  // 处理删除邮箱
  const handleDeleteMailbox = async () => {
    if (!address) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/mailboxes/${address}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete mailbox');
      }
      
      const data = await response.json();
      if (data.success) {
        toast({
          title: t('common.success'),
          description: t('mailbox.deleteSuccess'),
        });
        navigate('/');
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error) {
      toast({
        title: t('errors.generic'),
        description: t('mailbox.deleteFailed'),
        variant: 'destructive',
      });
    }
  };
  
  return (
    <div className="flex flex-col space-y-6">
      {mailbox && (
        <MailboxInfo 
          mailbox={mailbox} 
          onDelete={handleDeleteMailbox}
          autoRefresh={autoRefresh}
          onToggleAutoRefresh={() => setAutoRefresh(!autoRefresh)}
        />
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <EmailList 
            emails={emails} 
            selectedEmailId={selectedEmail}
            onSelectEmail={setSelectedEmail}
            isLoading={isLoading}
          />
        </div>
        <div className="md:col-span-2">
          {selectedEmail ? (
            <EmailDetail 
              emailId={selectedEmail} 
              onClose={() => setSelectedEmail(null)}
            />
          ) : (
            <div className="border rounded-lg p-6 h-full flex items-center justify-center">
              <p className="text-muted-foreground text-center">
                {emails.length > 0 
                  ? t('email.selectEmailPrompt') 
                  : t('email.emptyInbox')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MailboxPage; 