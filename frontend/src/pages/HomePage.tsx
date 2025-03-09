import React, { useContext, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import EmailList from '../components/EmailList';
import { MailboxContext } from '../contexts/MailboxContext';
import { getEmails } from '../utils/api';
import Container from '../components/Container';

// 添加结构化数据组件
const StructuredData: React.FC = () => {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "ZMAIL-24小时匿名邮箱",
    "applicationCategory": "UtilityApplication",
    "operatingSystem": "All",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "CNY"
    },
    "description": "创建临时邮箱地址，接收邮件，无需注册，保护您的隐私安全",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "1024"
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
};

const HomePage: React.FC = () => {
  const { t } = useTranslation();
  const { 
    mailbox, 
    isLoading, 
    emails, 
    setEmails, 
    selectedEmail, 
    setSelectedEmail, 
    isEmailsLoading, 
    setIsEmailsLoading, 
    autoRefresh,
    handleMailboxNotFound
  } = useContext(MailboxContext);
  
  // 使用ref来跟踪是否已经处理过404错误
  const handlingNotFoundRef = useRef(false);
  
  // 获取邮件列表
  useEffect(() => {
    if (!mailbox) return;
    
    const fetchEmails = async () => {
      // 如果正在处理404错误，则跳过
      if (handlingNotFoundRef.current) return;
      
      try {
        setIsEmailsLoading(true);
        const result = await getEmails(mailbox.address);
        setIsEmailsLoading(false);
        
        if (result.success) {
          setEmails(result.emails);
        } else if (result.notFound) {
          // 设置标志，防止循环调用
          handlingNotFoundRef.current = true;
          
          // 如果邮箱不存在，清除本地缓存并创建新邮箱
          try {
            if (typeof handleMailboxNotFound === 'function') {
              await handleMailboxNotFound();
            } else {
              // 如果handleMailboxNotFound不是函数，则手动清除缓存并刷新页面
              localStorage.removeItem('tempMailbox');
              localStorage.removeItem(`emailCache_${mailbox.address}`);
              window.location.href = '/';
            }
          } catch (error) {
            // 出错时也手动清除缓存并刷新页面
            localStorage.removeItem('tempMailbox');
            localStorage.removeItem(`emailCache_${mailbox.address}`);
            window.location.href = '/';
          }
        }
      } catch (error) {
        setIsEmailsLoading(false);
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
  }, [mailbox, autoRefresh, setEmails, setIsEmailsLoading]);
  
  if (isLoading) {
    return (
      <Container>
        <div className="flex justify-center items-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Container>
    );
  }
  
  return (
    <Container>
      <StructuredData />
      <EmailList 
        emails={emails} 
        selectedEmailId={selectedEmail}
        onSelectEmail={setSelectedEmail}
        isLoading={isEmailsLoading}
      />
    </Container>
  );
};

export default HomePage; 