#import <Foundation/Foundation.h>
#include <TargetConditionals.h>
#include "llama.h"
#include <atomic>
#include <algorithm>
#include <cstring>
#include <chrono>
#include <mutex>
#include <string>
#include <vector>

static std::atomic<uint64_t> localEpoch{0};
static std::mutex localLock;
static char * localResult(NSString * status, NSString * reply = @"") {
  NSData * data = [NSJSONSerialization dataWithJSONObject:@{@"status":status,@"reply":reply} options:0 error:nil];
  return strdup([[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding].UTF8String);
}
struct LocalRun { uint64_t epoch; std::chrono::steady_clock::time_point deadline; };
static bool localCancelled(void * value) {
  auto * run = static_cast<LocalRun *>(value);
  return run->epoch != localEpoch.load() || std::chrono::steady_clock::now() > run->deadline;
}

extern "C" __attribute__((visibility("default"))) char * sanhao_local_chat(const char * payload) {
  @autoreleasepool {
    if (!payload) return localResult(@"invalid");
    NSData * bytes = [NSData dataWithBytes:payload length:strlen(payload)];
    NSDictionary * request = [NSJSONSerialization JSONObjectWithData:bytes options:0 error:nil];
    if (![request isKindOfClass:NSDictionary.class]) return localResult(@"invalid");
    uint64_t epoch = ++localEpoch;
    if ([request[@"operation"] isEqual:@"cancel"]) return localResult(@"cancelled");
    NSString * prompt = request[@"prompt"];
    if (![prompt isKindOfClass:NSString.class] || [prompt lengthOfBytesUsingEncoding:NSUTF8StringEncoding] > 24000) return localResult(@"invalid");
    NSDictionary * resources=[NSUserDefaults.standardUserDefaults dictionaryForKey:@"sanhao.localmodel.resources"];
    NSString * path=[resources[@"base"] isKindOfClass:NSString.class] ? resources[@"base"] : nil;
    // The bundled fallback exists only for explicitly requested internal builds.
    if(!path)path=[NSBundle.mainBundle pathForResource:@"LocalChat" ofType:@"gguf" inDirectory:@"LocalModel"];
    if (!path) return localResult(@"unavailable");
    std::unique_lock<std::mutex> lock(localLock);
    LocalRun run{epoch,std::chrono::steady_clock::now()+std::chrono::seconds(30)};
    if (localCancelled(&run)) return localResult(@"cancelled");
    static std::once_flag initialized;
    std::call_once(initialized, [] { llama_log_set([](ggml_log_level,const char *,void *){},nullptr); llama_backend_init(); });
    auto mp = llama_model_default_params(); mp.n_gpu_layers = 99;
    #if TARGET_OS_SIMULATOR
    mp.n_gpu_layers = 0;
    #endif
    llama_model * model = llama_model_load_from_file(path.fileSystemRepresentation,mp);
    if (!model) return localResult(@"unavailable");
    auto cp = llama_context_default_params(); cp.n_ctx=2048; cp.n_batch=256; cp.n_ubatch=128;
    cp.n_threads=2; cp.n_threads_batch=2; cp.no_perf=true; cp.abort_callback=localCancelled; cp.abort_callback_data=&run;
    llama_context * context = llama_init_from_model(model,cp);
    if (!context) { llama_model_free(model); return localResult(@"unavailable"); }
    NSString * adapterPath=[resources[@"adapter"] isKindOfClass:NSString.class] ? resources[@"adapter"] : nil;
    if(!adapterPath)adapterPath=[NSBundle.mainBundle pathForResource:@"LocalChat-LoRA" ofType:@"gguf" inDirectory:@"LocalModel"];
    if(adapterPath) {
      auto * adapter=llama_adapter_lora_init(model,adapterPath.fileSystemRepresentation);
      float scale=1.0f;
      if(!adapter || llama_set_adapters_lora(context,&adapter,1,&scale)!=0) {
        llama_free(context);llama_model_free(model);return localResult(@"unavailable");
      }
    }
    const llama_vocab * vocab = llama_model_get_vocab(model);
    const std::string input(prompt.UTF8String);
    std::vector<llama_token> tokens(input.size()+16);
    int count = llama_tokenize(vocab,input.data(),(int)input.size(),tokens.data(),(int)tokens.size(),false,true);
    if (count<=0 || count>1900) { llama_free(context); llama_model_free(model); return localResult(@"tooLong"); }
    auto * sampler = llama_sampler_chain_init(llama_sampler_chain_default_params());
    llama_sampler_chain_add(sampler,llama_sampler_init_penalties(llama_vocab_n_tokens(vocab),64,1.0f,0,0));
    llama_sampler_chain_add(sampler,llama_sampler_init_top_k(20));
    llama_sampler_chain_add(sampler,llama_sampler_init_top_p(.8f,1));
    llama_sampler_chain_add(sampler,llama_sampler_init_temp(.7f));
    llama_sampler_chain_add(sampler,llama_sampler_init_dist(LLAMA_DEFAULT_SEED));
    bool ok = true;
    for (int offset=0;offset<count && ok;offset+=256) {
      if (localCancelled(&run)) { ok=false;break; }
      auto batch=llama_batch_get_one(tokens.data()+offset,std::min(256,count-offset));
      ok=llama_decode(context,batch)==0;
    }
    std::string output;
    if(ok) for(int i=0;i<112 && !localCancelled(&run);++i) {
      llama_token token=llama_sampler_sample(sampler,context,-1);
      if(llama_vocab_is_eog(vocab,token))break;
      char piece[1024]; int size=llama_token_to_piece(vocab,token,piece,sizeof(piece),0,false);
      if(size>0)output.append(piece,size);
      if(llama_decode(context,llama_batch_get_one(&token,1))!=0) { ok=false;break; }
    }
    bool cancelled=localCancelled(&run);
    llama_sampler_free(sampler); llama_free(context); llama_model_free(model);
    if(cancelled)return localResult(@"cancelled");
    if(!ok)return localResult(@"unavailable");
    NSString * reply=nil;
    for(int trim=0;trim<4 && trim<=(int)output.size() && !reply;++trim)
      reply=[[NSString alloc] initWithBytes:output.data() length:output.size()-trim encoding:NSUTF8StringEncoding];
    return localResult(reply.length ? @"ready" : @"empty",reply ?: @"");
  }
}
